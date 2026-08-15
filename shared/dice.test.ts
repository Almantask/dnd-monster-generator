import { describe, expect, it } from 'vitest'
import {
  abilityModifier,
  parseDiceExpressions,
  parseRecharge,
  parseToHit,
  roll,
  tokenizeCombatText,
} from './dice.ts'

describe('abilityModifier', () => {
  it('maps 18 to +4 and 10 to +0', () => {
    expect(abilityModifier(18)).toBe(4)
    expect(abilityModifier(10)).toBe(0)
    expect(abilityModifier(8)).toBe(-1)
  })
})

describe('parseDiceExpressions', () => {
  it('finds damage dice in a hit line', () => {
    const found = parseDiceExpressions(
      'Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 12 (2d6+5) slashing damage.',
    )
    expect(found).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ count: 2, sides: 6, bonus: 5 }),
      ]),
    )
  })

  it('parses hit dice', () => {
    const found = parseDiceExpressions('6d8+18')
    expect(found[0]).toMatchObject({ count: 6, sides: 8, bonus: 18 })
  })
})

describe('parseToHit', () => {
  it('extracts an attack bonus', () => {
    expect(parseToHit('+6 to hit')).toBe(6)
    expect(parseToHit('+4 to hit')).toBe(4)
  })
})

describe('parseRecharge', () => {
  it('detects recharge 5-6', () => {
    expect(parseRecharge('Reckless Cleave (Recharge 5-6)')).toEqual({ min: 5, max: 6 })
  })
})

describe('roll', () => {
  it('uses the provided rng', () => {
    const result = roll({ count: 2, sides: 6, bonus: 5 }, () => 0)
    expect(result.total).toBe(7)
    expect(result.dice).toEqual([1, 1])
  })
})

describe('tokenizeCombatText', () => {
  it('marks to-hit and damage as interactive tokens', () => {
    const tokens = tokenizeCombatText(
      'Melee Weapon Attack: +6 to hit, reach 5 ft. Hit: 12 (2d6+5) slashing damage.',
    )
    expect(tokens.some((t) => t.kind === 'toHit' && t.bonus === 6)).toBe(true)
    expect(tokens.some((t) => t.kind === 'dice' && t.expr.sides === 6)).toBe(true)
  })
})
