/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DiceProvider } from '@/hooks/DiceProvider.tsx'
import { DiceText } from './DiceText.tsx'

vi.mock('@/components/dice/DicePhysics.tsx', () => ({
  DicePhysics: () => null,
}))

function renderText(text: string) {
  return render(
    <DiceProvider>
      <DiceText text={text} label="Pike" />
    </DiceProvider>,
  )
}

describe('DiceText', () => {
  it('marks dice expressions, to-hit bonuses, and recharge with a tiny die', () => {
    renderText(
      'Melee Weapon Attack: +6 to hit, reach 5 ft. Hit: 12 (2d6+5) slashing. Recharge 5-6.',
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(3)
    for (const button of buttons) {
      expect(button.querySelector('[data-dice-marker]')).toBeTruthy()
    }
  })

  it('rolls the clicked expression', async () => {
    renderText('Hit: 12 (2d6+5) slashing damage.')
    await userEvent.click(screen.getByRole('button', { name: /2d6\+5/i }))
    expect(await screen.findByRole('dialog', { name: 'Dice roll' })).toBeTruthy()
  })
})
