export const CONJURE_HINTS: Array<{ maxSeconds: number; text: string }> = [
  { maxSeconds: 8, text: 'Consulting the ancient draconic bestiary…' },
  { maxSeconds: 18, text: 'Calculating challenge rating, hit dice & XP budget…' },
  { maxSeconds: 28, text: 'Sharpening claws, balancing save DCs, and penning traits…' },
  { maxSeconds: 38, text: 'Sneaking past the dungeon master’s screen…' },
  { maxSeconds: 48, text: 'Grinding rare minerals & brewing enchanted parchment ink…' },
  { maxSeconds: 56, text: 'Illuminating the creature portrait with arcane pigment…' },
  { maxSeconds: Infinity, text: 'Almost there…' },
]

export function getHintForSeconds(seconds: number): string {
  for (const hint of CONJURE_HINTS) {
    if (seconds < hint.maxSeconds) {
      return hint.text
    }
  }
  return 'Almost there…'
}
