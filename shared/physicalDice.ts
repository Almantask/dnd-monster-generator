import { formatDice, roll, type RollResult } from './dice.ts'

export const PHYSICAL_SIDES = [4, 6, 8, 10, 12, 20, 100] as const

export type PlannedRoll = {
  id: string
  label?: string
  count: number
  sides: number
  bonus: number
}

export type PhysicsGroup = {
  notation: string
  label: string
  kind: 'check' | 'damage'
}

export type PhysicsSettleResult = {
  rolls: Array<{ group?: string; value: number }>
}

const MAX_DICE_PER_GROUP = 20

export function isPhysicalDie(sides: number): boolean {
  return (PHYSICAL_SIDES as readonly number[]).includes(sides)
}

export function buildPhysicsGroups(plans: PlannedRoll[]): PhysicsGroup[] {
  const groups: PhysicsGroup[] = []
  for (const plan of plans) {
    if (!isPhysicalDie(plan.sides) || plan.count < 1) continue
    const kind: PhysicsGroup['kind'] = plan.sides === 20 ? 'check' : 'damage'
    let remaining = plan.count
    while (remaining > 0) {
      const n = Math.min(remaining, MAX_DICE_PER_GROUP)
      groups.push({
        notation: `${n}d${plan.sides}`,
        label: plan.id,
        kind,
      })
      remaining -= n
    }
  }
  return groups
}

export function resultFromPhysics(
  plan: PlannedRoll,
  values: number[],
  rng: () => number = Math.random,
): RollResult {
  // A die the physics never read is rolled here rather than dropped, which
  // would quietly leave the total short.
  const missing = Math.max(0, plan.count - values.length)
  const dice = [
    ...values.slice(0, plan.count),
    ...roll({ count: missing, sides: plan.sides, bonus: 0 }, rng).dice,
  ]
  const total = dice.reduce((sum, n) => sum + n, 0) + plan.bonus
  const expression = plan.label
    ? `${plan.label}: ${formatDice(plan)}`
    : formatDice(plan)
  return { expression, dice, bonus: plan.bonus, total }
}
