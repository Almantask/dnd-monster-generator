import { describe, expect, it } from 'vitest'
import { formatDice } from './dice.ts'
import {
  buildPhysicsGroups,
  isPhysicalDie,
  resultFromPhysics,
  type PlannedRoll,
} from './physicalDice.ts'

describe('isPhysicalDie', () => {
  it('accepts standard polyhedral sides', () => {
    expect([4, 6, 8, 10, 12, 20, 100].every(isPhysicalDie)).toBe(true)
  })

  it('rejects unusual sides that cannot be spawned as 3d dice', () => {
    expect(isPhysicalDie(3)).toBe(false)
    expect(isPhysicalDie(7)).toBe(false)
  })
})

describe('buildPhysicsGroups', () => {
  it('emits one die per count with no bonus in the notation', () => {
    const plan: PlannedRoll = {
      id: 'hit',
      label: 'Longsword',
      count: 2,
      sides: 6,
      bonus: 5,
    }
    expect(buildPhysicsGroups([plan])).toEqual([
      { notation: '2d6', label: 'hit', kind: 'damage' },
    ])
  })

  it('marks d20s as checks so they can use a distinct theme', () => {
    const plan: PlannedRoll = {
      id: 'str',
      label: 'STR',
      count: 1,
      sides: 20,
      bonus: 4,
    }
    expect(buildPhysicsGroups([plan])).toEqual([
      { notation: '1d20', label: 'str', kind: 'check' },
    ])
  })

  it('batches several clicked expressions into one throw', () => {
    const groups = buildPhysicsGroups([
      { id: 'to-hit', label: 'Pike to hit', count: 1, sides: 20, bonus: 6 },
      { id: 'dmg', label: 'Pike', count: 2, sides: 6, bonus: 5 },
    ])
    expect(groups.map((g) => g.notation)).toEqual(['1d20', '2d6'])
  })

  it('splits counts above 20 to stay within the physics cap', () => {
    const groups = buildPhysicsGroups([
      { id: 'fireball', label: 'Fireball', count: 24, sides: 6, bonus: 0 },
    ])
    expect(groups).toEqual([
      { notation: '20d6', label: 'fireball', kind: 'damage' },
      { notation: '4d6', label: 'fireball', kind: 'damage' },
    ])
  })

  it('skips dice that cannot be spawned physically', () => {
    expect(
      buildPhysicsGroups([{ id: 'odd', count: 1, sides: 3, bonus: 0 }]),
    ).toEqual([])
  })
})

describe('resultFromPhysics', () => {
  it('adds the original bonus to the settled face values', () => {
    const plan: PlannedRoll = {
      id: 'hit',
      label: 'Hit dice',
      count: 2,
      sides: 8,
      bonus: 4,
    }
    const result = resultFromPhysics(plan, [5, 3])
    expect(result.dice).toEqual([5, 3])
    expect(result.bonus).toBe(4)
    expect(result.total).toBe(12)
    expect(result.expression).toBe(`Hit dice: ${formatDice(plan)}`)
  })
})
