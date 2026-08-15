import { tokenizeCombatText } from '@shared/dice.ts'
import { useDice } from '@/hooks/useDice.ts'

export function DiceText({ text, label }: { text: string; label?: string }) {
  const { rollExpr, rollCheck } = useDice()
  const tokens = tokenizeCombatText(text)

  return (
    <span>
      {tokens.map((token, index) => {
        if (token.kind === 'text') return <span key={index}>{token.value}</span>
        if (token.kind === 'dice') {
          return (
            <button
              key={index}
              type="button"
              className="dice-hot"
              onClick={() => rollExpr(token.expr, label)}
            >
              {token.value}
            </button>
          )
        }
        if (token.kind === 'toHit') {
          return (
            <button
              key={index}
              type="button"
              className="dice-hot"
              onClick={() => rollCheck(token.bonus, label ? `${label} to hit` : 'to hit')}
            >
              {token.value}
            </button>
          )
        }
        return (
          <button
            key={index}
            type="button"
            className="dice-hot"
            onClick={() =>
              rollExpr({ count: 1, sides: 6, bonus: 0 }, label ? `${label} recharge` : 'Recharge')
            }
          >
            {token.value}
          </button>
        )
      })}
    </span>
  )
}
