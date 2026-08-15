import { createContext, useContext } from 'react'
import type { DiceExpr, RollResult } from '@shared/dice.ts'

export type DiceContextValue = {
  rolls: RollResult[]
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
