import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { roll, type DiceExpr, type RollResult } from '@shared/dice.ts'
import {
  buildPhysicsGroups,
  resultFromPhysics,
  type PhysicsSettleResult,
  type PlannedRoll,
} from '@shared/physicalDice.ts'
import { DiceContext, type TrayRoll } from './useDice.ts'

const OVERLAY_LINGER_MS = 3000

/**
 * three.js, react-three-fiber and Rapier's inlined WASM are most of the app's
 * JavaScript, yet only a dice throw needs them. Splitting them into their own
 * chunk keeps them off the first paint; the idle prefetch below still has them
 * ready long before most people click a roll.
 */
const loadDicePhysics = () => import('@/components/dice/DicePhysics.tsx')
const DicePhysics = lazy(() => loadDicePhysics().then((m) => ({ default: m.DicePhysics })))

function prefetchWhenIdle(): () => void {
  const warm = () => void loadDicePhysics()
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(warm, { timeout: 4000 })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(warm, 1500)
  return () => window.clearTimeout(id)
}

function mathResult(plan: PlannedRoll): RollResult {
  const result = roll({ count: plan.count, sides: plan.sides, bonus: plan.bonus })
  if (plan.label) result.expression = `${plan.label}: ${result.expression}`
  return result
}

export function DiceProvider({ children }: { children: ReactNode }) {
  const [rolls, setRolls] = useState<TrayRoll[]>([])
  const [pending, setPending] = useState<PlannedRoll[] | null>(null)
  const [banner, setBanner] = useState<RollResult[] | null>(null)
  const [throwId, setThrowId] = useState(0)
  const pendingRef = useRef<PlannedRoll[] | null>(null)
  const assembling = useRef<PlannedRoll[]>([])
  const flushScheduled = useRef(false)
  const rolling = useRef(false)
  const seq = useRef(0)
  const lingerTimer = useRef<number | undefined>(undefined)

  const rollId = useRef(0)

  const push = useCallback((result: RollResult) => {
    setRolls((current) => [{ ...result, id: ++rollId.current }, ...current].slice(0, 12))
  }, [])

  const dismissOverlay = useCallback(() => {
    window.clearTimeout(lingerTimer.current)
    rolling.current = false
    pendingRef.current = null
    setPending(null)
    setBanner(null)
  }, [])

  const flush = useCallback(() => {
    flushScheduled.current = false
    const batch = assembling.current
    assembling.current = []
    if (batch.length === 0) return

    if (rolling.current) {
      for (const plan of batch) push(mathResult(plan))
      return
    }

    const groups = buildPhysicsGroups(batch)
    const physicalIds = new Set(groups.map((group) => group.label))
    for (const plan of batch) {
      if (!physicalIds.has(plan.id)) push(mathResult(plan))
    }
    const physical = batch.filter((plan) => physicalIds.has(plan.id))
    if (physical.length === 0) return

    window.clearTimeout(lingerTimer.current)
    rolling.current = true
    pendingRef.current = physical
    setBanner(null)
    setPending(physical)
    setThrowId(seq.current)
  }, [push])

  const enqueue = useCallback(
    (plan: Omit<PlannedRoll, 'id'>) => {
      assembling.current.push({ ...plan, id: `roll-${++seq.current}` })
      if (flushScheduled.current) return
      flushScheduled.current = true
      queueMicrotask(flush)
    },
    [flush],
  )

  const rollExpr = useCallback(
    (expr: DiceExpr, label?: string) => {
      enqueue({ label, count: expr.count, sides: expr.sides, bonus: expr.bonus })
    },
    [enqueue],
  )

  const rollCheck = useCallback(
    (bonus: number, label?: string) => {
      enqueue({ label, count: 1, sides: 20, bonus })
    },
    [enqueue],
  )

  const completeThrow = useCallback(
    (result: PhysicsSettleResult) => {
      const batch = pendingRef.current
      pendingRef.current = null
      rolling.current = false
      if (!batch) return

      const valuesById: Record<string, number[]> = {}
      for (const die of result.rolls) {
        if (!die.group) continue
        valuesById[die.group] ??= []
        valuesById[die.group].push(die.value)
      }
      const next = batch.map((plan) => {
        const values = valuesById[plan.id]
        return values?.length ? resultFromPhysics(plan, values) : mathResult(plan)
      })
      for (const item of next) push(item)
      setBanner(next)
      window.clearTimeout(lingerTimer.current)
      lingerTimer.current = window.setTimeout(dismissOverlay, OVERLAY_LINGER_MS)
    },
    [dismissOverlay, push],
  )

  const clear = useCallback(() => setRolls([]), [])

  useEffect(
    () => () => {
      window.clearTimeout(lingerTimer.current)
    },
    [],
  )

  useEffect(prefetchWhenIdle, [])

  const value = useMemo(
    () => ({ rolls, push, rollExpr, rollCheck, clear }),
    [rolls, push, rollExpr, rollCheck, clear],
  )

  const groups = pending ? buildPhysicsGroups(pending) : null

  return (
    <DiceContext.Provider value={value}>
      {children}
      {groups ? (
        <div
          role="dialog"
          aria-label="Dice roll"
          aria-modal="true"
          className="anim-fade fixed inset-0 z-[80] bg-ink/45"
          onClick={banner ? dismissOverlay : undefined}
        >
          <Suspense
            fallback={
              <p className="font-display text-parchment absolute inset-x-0 top-1/2 text-center tracking-widest uppercase">
                Readying the dice…
              </p>
            }
          >
            <DicePhysics key={throwId} groups={groups} onComplete={completeThrow} />
          </Suspense>
          {banner ? (
            <ul className="pointer-events-none absolute inset-x-0 bottom-10 z-[82] mx-auto flex max-w-xl flex-col items-center gap-1 px-4 text-center">
              {banner.map((item) => (
                <li
                  key={item.expression}
                  className="anim-pop roll-chip roll-chip-latest font-display text-oxblood px-3 py-1"
                >
                  {item.expression} <strong>{item.total}</strong>
                  <span className="text-ink/70"> [{item.dice.join(', ')}]</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </DiceContext.Provider>
  )
}
