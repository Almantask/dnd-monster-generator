export type DiceExpr = {
  count: number
  sides: number
  bonus: number
}

export type RollResult = {
  expression: string
  dice: number[]
  bonus: number
  total: number
}

const DICE_RE = /(\d+)\s*d\s*(\d+)\s*([+-]\s*\d+)?/gi
const TO_HIT_RE = /([+-]\s*\d+)\s+to hit/i
const RECHARGE_RE = /recharge\s+(\d+)\s*[–-]\s*(\d+)/i

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : String(mod)
}

export function parseDiceExpressions(text: string): DiceExpr[] {
  const found: DiceExpr[] = []
  const re = new RegExp(DICE_RE.source, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    found.push({
      count: Number(match[1]),
      sides: Number(match[2]),
      bonus: match[3] ? Number(match[3].replace(/\s/g, '')) : 0,
    })
  }
  return found
}

export function parseToHit(text: string): number | null {
  const match = TO_HIT_RE.exec(text)
  if (!match) return null
  return Number(match[1].replace(/\s/g, ''))
}

export function parseRecharge(text: string): { min: number; max: number } | null {
  const match = RECHARGE_RE.exec(text)
  if (!match) return null
  return { min: Number(match[1]), max: Number(match[2]) }
}

export function formatDice(expr: DiceExpr): string {
  const bonus =
    expr.bonus === 0
      ? ''
      : expr.bonus > 0
        ? `+${expr.bonus}`
        : String(expr.bonus)
  return `${expr.count}d${expr.sides}${bonus}`
}

export function roll(
  expr: DiceExpr,
  rng: () => number = Math.random,
): RollResult {
  const dice: number[] = []
  for (let i = 0; i < expr.count; i += 1) {
    dice.push(1 + Math.floor(rng() * expr.sides))
  }
  const total = dice.reduce((sum, n) => sum + n, 0) + expr.bonus
  return { expression: formatDice(expr), dice, bonus: expr.bonus, total }
}

export function rollD20(bonus: number, rng: () => number = Math.random): RollResult {
  return roll({ count: 1, sides: 20, bonus }, rng)
}

export type TextToken =
  | { kind: 'text'; value: string }
  | { kind: 'dice'; value: string; expr: DiceExpr }
  | { kind: 'toHit'; value: string; bonus: number }
  | { kind: 'recharge'; value: string; min: number; max: number }

export function tokenizeCombatText(text: string): TextToken[] {
  const tokens: TextToken[] = []
  const combined = new RegExp(
    `${RECHARGE_RE.source}|${TO_HIT_RE.source}|${DICE_RE.source}`,
    'gi',
  )
  let last = 0
  let match: RegExpExecArray | null
  while ((match = combined.exec(text))) {
    if (match.index > last) {
      tokens.push({ kind: 'text', value: text.slice(last, match.index) })
    }
    const value = match[0]
    const recharge = parseRecharge(value)
    const toHit = parseToHit(value)
    const dice = parseDiceExpressions(value)[0]
    if (recharge) tokens.push({ kind: 'recharge', value, ...recharge })
    else if (toHit !== null) tokens.push({ kind: 'toHit', value, bonus: toHit })
    else if (dice) tokens.push({ kind: 'dice', value, expr: dice })
    else tokens.push({ kind: 'text', value })
    last = match.index + value.length
  }
  if (last < text.length) tokens.push({ kind: 'text', value: text.slice(last) })
  return tokens.length ? tokens : [{ kind: 'text', value: text }]
}
