/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DiceProvider } from './DiceProvider.tsx'
import { useDice } from './useDice.ts'
import { DiceTray } from '@/components/dice/DiceTray.tsx'
import type { PhysicsGroup } from '@shared/physicalDice.ts'

vi.mock('@/components/dice/DicePhysics.tsx', () => ({
  DicePhysics: ({
    groups,
    onComplete,
  }: {
    groups: PhysicsGroup[]
    onComplete: (result: { rolls: Array<{ group?: string; value: number }> }) => void
  }) => (
    <div data-testid="dice-physics">
      <p>{groups.map((group) => group.notation).join(' ')}</p>
      <button
        type="button"
        onClick={() =>
          onComplete({
            rolls: groups.flatMap((group) => {
              const count = Number(/^(\d+)d/i.exec(group.notation)?.[1] ?? 1)
              return Array.from({ length: count }, () => ({ group: group.label, value: 4 }))
            }),
          })
        }
      >
        settle
      </button>
    </div>
  ),
}))

function Probe() {
  const dice = useDice()
  return (
    <>
      <button
        type="button"
        onClick={() => dice.rollExpr({ count: 2, sides: 6, bonus: 5 }, 'Pike')}
      >
        roll pike
      </button>
      <button type="button" onClick={() => dice.rollCheck(4, 'STR')}>
        roll str
      </button>
      <button
        type="button"
        onClick={() => {
          dice.rollCheck(6, 'Pike to hit')
          dice.rollExpr({ count: 2, sides: 6, bonus: 5 }, 'Pike')
        }}
      >
        roll attack
      </button>
    </>
  )
}

function renderDice() {
  return render(
    <DiceProvider>
      <Probe />
      <DiceTray />
    </DiceProvider>,
  )
}

describe('DiceProvider physics overlay', () => {
  it('overlays 2d6 when a 2d6 expression is clicked', async () => {
    renderDice()
    await userEvent.click(screen.getByRole('button', { name: 'roll pike' }))
    expect(await screen.findByRole('dialog', { name: 'Dice roll' })).toBeTruthy()
    expect(await screen.findByText('2d6')).toBeTruthy()
  })

  it('overlays one d20 for an ability check', async () => {
    renderDice()
    await userEvent.click(screen.getByRole('button', { name: 'roll str' }))
    expect(await screen.findByText('1d20')).toBeTruthy()
  })

  it('overlays every die from a combined attack click', async () => {
    renderDice()
    await userEvent.click(screen.getByRole('button', { name: 'roll attack' }))
    expect(await screen.findByText('1d20 2d6')).toBeTruthy()
  })

  it('writes physics totals plus the original bonus into the tray', async () => {
    renderDice()
    await userEvent.click(screen.getByRole('button', { name: 'roll pike' }))
    await userEvent.click(await screen.findByRole('button', { name: 'settle' }))
    const tray = screen.getByLabelText('Dice tray')
    await waitFor(() => {
      expect(within(tray).getByText(/Pike: 2d6\+5/)).toBeTruthy()
      expect(within(tray).getByText('13')).toBeTruthy()
    })
  })
})
