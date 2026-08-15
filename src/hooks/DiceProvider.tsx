import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { roll, rollD20, type DiceExpr, type RollResult } from '@shared/dice.ts'
import { DiceContext } from './useDice.ts'

export function DiceProvider({ children }: { children: ReactNode }) {
  const [rolls, setRolls] = useState<RollResult[]>([])

  const push = useCallback((result: RollResult) => {
    setRolls((current) => [result, ...current].slice(0, 12))
  }, [])

  const rollExpr = useCallback(
    (expr: DiceExpr, label?: string) => {
      const result = roll(expr)
      if (label) result.expression = `${label}: ${result.expression}`
      push(result)
      return result
    },
    [push],
  )

  const rollCheck = useCallback(
    (bonus: number, label?: string) => {
      const result = rollD20(bonus)
      if (label) result.expression = `${label}: ${result.expression}`
      push(result)
      return result
    },
    [push],
  )

  const clear = useCallback(() => setRolls([]), [])

  const value = useMemo(
    () => ({ rolls, push, rollExpr, rollCheck, clear }),
    [rolls, push, rollExpr, rollCheck, clear],
  )

  return <DiceContext.Provider value={value}>{children}</DiceContext.Provider>
}
