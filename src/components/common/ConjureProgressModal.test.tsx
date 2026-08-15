/** @vitest-environment jsdom */
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConjureProgressModal } from './ConjureProgressModal.tsx'
import { CONJURE_HINTS, getHintForSeconds } from './conjureHints.ts'

describe('ConjureProgressModal & Hints', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('correctly maps seconds across 20s to appropriate hints and ends with almost there', () => {
    expect(getHintForSeconds(0)).toBe(CONJURE_HINTS[0]!.text)
    expect(getHintForSeconds(2)).toBe('Consulting the ancient draconic bestiary…')
    expect(getHintForSeconds(5)).toBe('Calculating challenge rating, hit dice & XP budget…')
    expect(getHintForSeconds(8)).toBe('Sharpening claws, balancing save DCs, and penning traits…')
    expect(getHintForSeconds(11)).toBe('Sneaking past the dungeon master’s screen…')
    expect(getHintForSeconds(14)).toBe('Grinding rare minerals & brewing enchanted parchment ink…')
    expect(getHintForSeconds(17)).toBe('Illuminating the creature portrait with arcane pigment…')
    expect(getHintForSeconds(18)).toBe('Almost there…')
    expect(getHintForSeconds(20)).toBe('Almost there…')
    expect(getHintForSeconds(30)).toBe('Almost there…')
  })

  it('renders Kobold running animation and progressive timer', () => {
    render(<ConjureProgressModal busy="stats" name="Goblin Shaman" />)

    expect(screen.getByText('Inscribing Statblock')).toBeTruthy()
    expect(screen.getByText(/Summoning "Goblin Shaman"/)).toBeTruthy()
    expect(screen.getByText('0s / 20s')).toBeTruthy()
    expect(screen.getByText('“Consulting the ancient draconic bestiary…”')).toBeTruthy()

    // Advance by 10 seconds
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(screen.getByText('10s / 20s')).toBeTruthy()
    expect(screen.getByText('“Sneaking past the dungeon master’s screen…”')).toBeTruthy()

    // Advance to 19 seconds
    act(() => {
      vi.advanceTimersByTime(9000)
    })
    expect(screen.getByText('19s / 20s')).toBeTruthy()
    expect(screen.getByText('“Almost there…”')).toBeTruthy()
  })
})
