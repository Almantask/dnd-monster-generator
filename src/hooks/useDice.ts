import { createContext, useContext } from 'react'
import type { DiceExpr, RollResult } from '@shared/dice.ts'

/** A roll in the tray, tagged with a stable id so React can key it without
 *  remounting (and re-animating) every other chip when a new roll lands. */
export type TrayRoll = RollResult & { id: number }

export type DiceContextValue = {
  rolls: TrayRoll[]
  push: (result: RollResult) => void
  rollExpr: (expr: DiceExpr, label?: string) => void
  rollCheck: (bonus: number, label?: string) => void
  clear: () => void
}

export const DiceContext = createContext<DiceContextValue | null>(null)

export function useDice() {
  const ctx = useContext(DiceContext)
  if (!ctx) throw new Error('useDice must be used within DiceProvider')
  return ctx
}
