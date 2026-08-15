import type { Difficulty } from './taxonomies.ts'

const XP_THRESHOLDS: Record<
  number,
  { easy: number; medium: number; hard: number; deadly: number }
> = {
  1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
  2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
  3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
  4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
  5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
  6: { easy: 300, medium: 600, hard: 900, deadly: 1400 },
  7: { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
  8: { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
  9: { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
  10: { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
  11: { easy: 800, medium: 1600, hard: 2400, deadly: 3600 },
  12: { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
  13: { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
  14: { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
  15: { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
  16: { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
  17: { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
  18: { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
  19: { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
  20: { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 },
}

export const CR_XP: Record<string, number> = {
  '0': 10,
  '1/8': 25,
  '1/4': 50,
  '1/2': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
  '21': 33000,
  '22': 41000,
  '23': 50000,
  '24': 62000,
  '25': 75000,
  '26': 90000,
  '27': 105000,
  '28': 120000,
  '29': 135000,
  '30': 155000,
}

export const CR_ORDER = Object.keys(CR_XP)

/** DMG monster statistics by CR — used to calibrate generated statblocks. */
export const CR_CALIBRATION: Record<
  string,
  { ac: number; hp: string; attack: number; damage: string; saveDc: number }
> = {
  '0': { ac: 12, hp: '1–6', attack: 3, damage: '0–1', saveDc: 13 },
  '1/8': { ac: 13, hp: '7–35', attack: 3, damage: '2–3', saveDc: 13 },
  '1/4': { ac: 13, hp: '36–49', attack: 3, damage: '4–5', saveDc: 13 },
  '1/2': { ac: 13, hp: '50–70', attack: 3, damage: '6–8', saveDc: 13 },
  '1': { ac: 13, hp: '71–85', attack: 3, damage: '9–14', saveDc: 13 },
  '2': { ac: 13, hp: '86–100', attack: 3, damage: '15–20', saveDc: 13 },
  '3': { ac: 13, hp: '101–115', attack: 4, damage: '21–26', saveDc: 13 },
  '4': { ac: 14, hp: '116–130', attack: 5, damage: '27–32', saveDc: 14 },
  '5': { ac: 15, hp: '131–145', attack: 6, damage: '33–38', saveDc: 15 },
  '6': { ac: 15, hp: '146–160', attack: 6, damage: '39–44', saveDc: 15 },
  '7': { ac: 15, hp: '161–175', attack: 6, damage: '45–50', saveDc: 15 },
  '8': { ac: 16, hp: '176–190', attack: 7, damage: '51–56', saveDc: 16 },
  '9': { ac: 16, hp: '191–205', attack: 7, damage: '57–62', saveDc: 16 },
  '10': { ac: 17, hp: '206–220', attack: 7, damage: '63–68', saveDc: 16 },
  '11': { ac: 17, hp: '221–235', attack: 8, damage: '69–74', saveDc: 17 },
  '12': { ac: 17, hp: '236–250', attack: 8, damage: '75–80', saveDc: 17 },
  '13': { ac: 18, hp: '251–265', attack: 8, damage: '81–86', saveDc: 18 },
  '14': { ac: 18, hp: '266–280', attack: 8, damage: '87–92', saveDc: 18 },
  '15': { ac: 18, hp: '281–295', attack: 8, damage: '93–98', saveDc: 18 },
  '16': { ac: 18, hp: '296–310', attack: 9, damage: '99–104', saveDc: 18 },
  '17': { ac: 19, hp: '311–325', attack: 10, damage: '105–110', saveDc: 19 },
  '18': { ac: 19, hp: '326–340', attack: 10, damage: '111–116', saveDc: 19 },
  '19': { ac: 19, hp: '341–355', attack: 10, damage: '117–122', saveDc: 19 },
  '20': { ac: 19, hp: '356–400', attack: 10, damage: '123–140', saveDc: 19 },
  '21': { ac: 19, hp: '401–445', attack: 11, damage: '141–158', saveDc: 20 },
  '22': { ac: 19, hp: '446–490', attack: 11, damage: '159–176', saveDc: 20 },
  '23': { ac: 19, hp: '491–535', attack: 11, damage: '177–194', saveDc: 20 },
  '24': { ac: 19, hp: '536–580', attack: 12, damage: '195–212', saveDc: 21 },
  '25': { ac: 19, hp: '581–625', attack: 12, damage: '213–230', saveDc: 21 },
  '30': { ac: 20, hp: '851–900', attack: 14, damage: '297–320', saveDc: 23 },
}

function perCharacterXp(level: number, difficulty: Difficulty): number {
  const row = XP_THRESHOLDS[level] ?? XP_THRESHOLDS[1]
  if (difficulty === 'very easy') return Math.round(row.easy * 0.5)
  if (difficulty === 'very hard') return Math.round((row.hard + row.deadly) / 2)
  return row[difficulty]
}

export function encounterBudget(
  partySize: number,
  characterLevel: number,
  difficulty: Difficulty,
): number {
  return partySize * perCharacterXp(characterLevel, difficulty)
}

/** Encounter multiplier for a single monster vs a party of this size. */
export function singleMonsterMultiplier(partySize: number): number {
  if (partySize <= 2) return 1.5
  if (partySize >= 7) return 0.5
  return 1
}

export function monsterXp(cr: string): number {
  return CR_XP[cr] ?? 0
}

export function suggestChallengeRating(
  partySize: number,
  characterLevel: number,
  difficulty: Difficulty,
): string {
  const budget = encounterBudget(partySize, characterLevel, difficulty)
  const multiplier = singleMonsterMultiplier(partySize)
  const targetXp = budget / multiplier
  let best = '0'
  let bestDelta = Infinity
  for (const cr of CR_ORDER) {
    const xp = CR_XP[cr] ?? 0
    const delta = Math.abs(xp - targetXp)
    if (delta < bestDelta) {
      best = cr
      bestDelta = delta
    }
  }
  return best
}

export function calibrationFor(cr: string) {
  return CR_CALIBRATION[cr] ?? CR_CALIBRATION['1']
}
