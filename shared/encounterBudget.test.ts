import { describe, expect, it } from 'vitest'
import { encounterBudget, monsterXp, suggestChallengeRating } from './encounterBudget.ts'

describe('encounterBudget', () => {
  it('sums per-character XP for a medium party of four 5th-levels', () => {
    expect(encounterBudget(4, 5, 'medium')).toBe(2000)
  })

  it('treats very easy as half of easy', () => {
    expect(encounterBudget(1, 1, 'very easy')).toBe(13)
  })

  it('treats very hard as the midpoint of hard and deadly', () => {
    expect(encounterBudget(1, 1, 'very hard')).toBe(88)
  })
})

describe('suggestChallengeRating', () => {
  it('picks CR 2 for four 2nd-level characters at medium (single monster)', () => {
    expect(suggestChallengeRating(4, 2, 'medium')).toBe('2')
  })

  it('returns a fractional CR for a lone 1st-level character on very easy', () => {
    const cr = suggestChallengeRating(1, 1, 'very easy')
    expect(['0', '1/8', '1/4', '1/2']).toContain(cr)
  })

  it('looks up monster XP by CR', () => {
    expect(monsterXp('2')).toBe(450)
    expect(monsterXp('1/2')).toBe(100)
  })
})
