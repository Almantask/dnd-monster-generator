import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  if (typeof document !== 'undefined') cleanup()
})

vi.mock('react-ttrpg-dice', () => ({
  useDiceRoll: () => ({
    roll: vi.fn(),
    rollGroups: vi.fn(),
    isRolling: false,
    result: null,
    activeNotation: null,
    DiceOverlayPortal: null,
  }),
}))
