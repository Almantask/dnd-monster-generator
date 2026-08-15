import { tokenizeCombatText } from '@shared/dice.ts'
import { useDice } from '@/hooks/useDice.ts'
import { DiceHotButton } from './DiceHotButton.tsx'

export function DiceText({ text, label }: { text: string; label?: string }) {
  const { rollExpr, rollCheck } = useDice()
  const tokens = tokenizeCombatText(text)

  return (
    <span>
      {tokens.map((token, index) => {
        if (token.kind === 'text') return <span key={index}>{token.value}</span>
        if (token.kind === 'dice') {
          return (
            <DiceHotButton key={index} onClick={() => rollExpr(token.expr, label)}>
              {token.value}
            </DiceHotButton>
          )
        }
        if (token.kind === 'toHit') {
          return (
            <DiceHotButton
              key={index}
              onClick={() => rollCheck(token.bonus, label ? `${label} to hit` : 'to hit')}
            >
              {token.value}
            </DiceHotButton>
          )
        }
        return (
          <DiceHotButton
            key={index}
            onClick={() =>
              rollExpr({ count: 1, sides: 6, bonus: 0 }, label ? `${label} recharge` : 'Recharge')
            }
          >
            {token.value}
          </DiceHotButton>
        )
      })}
    </span>
  )
}
