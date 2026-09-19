import { useEffect, useRef } from 'react'
import { DieRegistry, useDiceRoll, type DieDefinition, type DiePhysicsConfig } from 'react-ttrpg-dice'
import type { PhysicsGroup, PhysicsSettleResult } from '@shared/physicalDice.ts'

const CHECK_THEME = {
  theme: 'crimson' as const,
  dieColor: '#822000',
  numberColor: '#fdf1dc',
  accentColor: '#5c0000',
}

const DAMAGE_THEME = {
  theme: 'ivory' as const,
  dieColor: '#fdf1dc',
  numberColor: '#822000',
  accentColor: '#922610',
}

/**
 * Contact tuning for the ~3.3× gravity the build-time patch sets on the dice
 * world (see vite.patchTtrpgDiceThrow.ts).  The stock values assume a 9.81
 * world, where they read as dice rolling through treacle.
 *
 * The rule of thumb: the rounder a die, the less it should grip (it wants to
 * roll off its last edge rather than stop dead on it), while a d4 is a brick
 * that should bite and stay put.  Damping is kept near zero so friction does
 * the work — the patch's progressive damping ramp still guarantees every die
 * comes to rest in time for the result read.
 *
 * Mass is deliberately absent: react-three-rapier ignores the registry's mass
 * and weighs each body by its collider volume, so tuning it here does nothing.
 */
const CONTACT_TUNING: Record<string, Partial<DiePhysicsConfig>> = {
  d4: { friction: 0.85, restitution: 0.25, linearDamping: 0.06, angularDamping: 0.14 },
  d6: { friction: 0.75, restitution: 0.4, linearDamping: 0.05, angularDamping: 0.1 },
  dF: { friction: 0.75, restitution: 0.4, linearDamping: 0.05, angularDamping: 0.1 },
  d8: { friction: 0.68, restitution: 0.42, linearDamping: 0.05, angularDamping: 0.1 },
  d10: { friction: 0.62, restitution: 0.4, linearDamping: 0.05, angularDamping: 0.1 },
  'd10-tens': { friction: 0.62, restitution: 0.4, linearDamping: 0.05, angularDamping: 0.1 },
  d12: { friction: 0.58, restitution: 0.4, linearDamping: 0.04, angularDamping: 0.09 },
  d20: { friction: 0.55, restitution: 0.42, linearDamping: 0.04, angularDamping: 0.08 },
}

/** Module-level so the overlay's registry memo never sees a new array. */
const TUNED_DICE: DieDefinition[] = (() => {
  const stock = new DieRegistry()
  return Object.entries(CONTACT_TUNING).map(([id, physics]) => {
    const definition = stock.get(id)
    return { ...definition, physics: { ...definition.physics, ...physics } }
  })
})()

/**
 * A throw now reports in ~2.5s, or a little longer while a cocked die is
 * nudged flat, so the stock 6s cap only delayed results that had genuinely
 * stalled.  When the cap does fire, unread dice are read where they lie.
 */
const SETTLE_TIMEOUT_MS = 4500

export function DicePhysics({
  groups,
  onComplete,
}: {
  groups: PhysicsGroup[]
  onComplete: (result: PhysicsSettleResult) => void
}) {
  const launched = useRef(false)
  const { rollGroups, DiceOverlayPortal } = useDiceRoll({
    config: DAMAGE_THEME,
    customRegistry: TUNED_DICE,
    sound: { volume: 0.35 },
    cameraAngle: { x: 2, z: 3 },
    timeout: SETTLE_TIMEOUT_MS,
    zIndex: 81,
    onRollComplete: onComplete,
  })

  useEffect(() => {
    if (launched.current || groups.length === 0) return
    launched.current = true
    rollGroups(
      groups.map((group) => ({
        notation: group.notation,
        label: group.label,
        config: group.kind === 'check' ? CHECK_THEME : DAMAGE_THEME,
      })),
    )
  }, [groups, rollGroups])

  return <>{DiceOverlayPortal}</>
}
