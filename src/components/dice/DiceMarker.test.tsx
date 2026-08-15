/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DiceMarker } from './DiceMarker.tsx'
import { DiceHotButton } from './DiceHotButton.tsx'

describe('DiceMarker', () => {
  it('renders a decorative dice icon', () => {
    render(<DiceMarker />)
    expect(document.querySelector('[data-dice-marker]')).toBeTruthy()
  })
})

describe('DiceHotButton', () => {
  it('shows a tiny dice marker next to the clickable label', () => {
    render(<DiceHotButton onClick={() => undefined}>2d6+5</DiceHotButton>)
    const button = screen.getByRole('button', { name: /2d6\+5/i })
    expect(button.querySelector('[data-dice-marker]')).toBeTruthy()
  })

  it('invokes onClick when pressed', async () => {
    const onClick = vi.fn()
    render(<DiceHotButton onClick={onClick}>1d20</DiceHotButton>)
    await userEvent.click(screen.getByRole('button', { name: /1d20/i }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
