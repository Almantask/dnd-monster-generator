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

  it('correctly maps seconds across 60s to appropriate hints and ends with almost there', () => {
    expect(getHintForSeconds(0)).toBe(CONJURE_HINTS[0]!.text)
    expect(getHintForSeconds(5)).toBe('Consulting the ancient draconic bestiary…')
    expect(getHintForSeconds(12)).toBe('Calculating challenge rating, hit dice & XP budget…')
    expect(getHintForSeconds(22)).toBe('Sharpening claws, balancing save DCs, and penning traits…')
    expect(getHintForSeconds(32)).toBe('Sneaking past the dungeon master’s screen…')
    expect(getHintForSeconds(42)).toBe('Grinding rare minerals & brewing enchanted parchment ink…')
    expect(getHintForSeconds(52)).toBe('Illuminating the creature portrait with arcane pigment…')
    expect(getHintForSeconds(56)).toBe('Almost there…')
    expect(getHintForSeconds(60)).toBe('Almost there…')
    expect(getHintForSeconds(80)).toBe('Almost there…')
  })

  it('renders Kobold running animation and progressive timer', () => {
    render(<ConjureProgressModal busy="stats" name="Goblin Shaman" />)

    expect(screen.getByText('Inscribing Statblock')).toBeTruthy()
    expect(screen.getByText(/Summoning "Goblin Shaman"/)).toBeTruthy()
    expect(screen.getByText('0s / 60s')).toBeTruthy()
    expect(screen.getByText('“Consulting the ancient draconic bestiary…”')).toBeTruthy()

    // Advance by 30 seconds
    act(() => {
      vi.advanceTimersByTime(30000)
    })
    expect(screen.getByText('30s / 60s')).toBeTruthy()
    expect(screen.getByText('“Sneaking past the dungeon master’s screen…”')).toBeTruthy()

    // Advance to 58 seconds
    act(() => {
      vi.advanceTimersByTime(28000)
    })
    expect(screen.getByText('58s / 60s')).toBeTruthy()
    expect(screen.getByText('“Almost there…”')).toBeTruthy()
  })
})
