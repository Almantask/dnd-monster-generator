import { parseRecharge, parseToHit } from '@shared/dice.ts'
import type { useDice } from '@/hooks/useDice.ts'

export function rollFeature(text: string, name: string, dice: ReturnType<typeof useDice>) {
  const toHit = parseToHit(text)
  const recharge = parseRecharge(text)
  if (toHit !== null) dice.rollCheck(toHit, `${name} to hit`)
  const exprs = text.match(/\d+d\d+(?:\s*[+-]\s*\d+)?/gi)
  if (exprs) {
    for (const raw of exprs) {
      const parsed = raw.replace(/\s/g, '')
      const match = /(\d+)d(\d+)([+-]\d+)?/i.exec(parsed)
      if (match) {
        dice.rollExpr(
          {
            count: Number(match[1]),
            sides: Number(match[2]),
            bonus: match[3] ? Number(match[3]) : 0,
          },
          name,
        )
      }
    }
  } else if (recharge) {
    dice.rollExpr({ count: 1, sides: 6, bonus: 0 }, `${name} recharge`)
  }
}
