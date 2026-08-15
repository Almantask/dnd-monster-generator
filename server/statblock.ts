import { STATBLOCK_MODELS } from '../shared/aiModels.ts'
import {
  ARCHETYPES,
  DIFFICULTIES,
  GROUPS,
  HABITATS,
  LOCOMOTIONS,
  PERSONALITIES,
  SIZES,
  type Difficulty,
} from '../shared/taxonomies.ts'
import { generatedMonsterSchema } from '../shared/monsterSchema.ts'
import {
  calibrationFor,
  encounterBudget,
  suggestChallengeRating,
} from '../shared/encounterBudget.ts'

function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const raw = fenced?.[1] ?? text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object in model response')
  return JSON.parse(raw.slice(start, end + 1)) as unknown
}

async function complete(model: string, messages: { role: string; content: string }[]) {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY is not set')
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.PUBLIC_ORIGIN ?? 'https://github.com',
      'X-Title': 'The Bestiary',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`${model} failed (${res.status}): ${errText.slice(0, 400)}`)
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error(`${model} returned no content`)
  return content
}

function buildPrompt(input: {
  name: string
  partySize: number
  characterLevel: number
  difficulty: Difficulty
  description: string
}): string {
  const cr = suggestChallengeRating(input.partySize, input.characterLevel, input.difficulty)
  const budget = encounterBudget(input.partySize, input.characterLevel, input.difficulty)
  const cal = calibrationFor(cr)
  return `You are a D&D 5e (2014) monster designer. Return ONLY a JSON object matching this schema (no markdown):
{
  "name": string,
  "size": one of ${JSON.stringify(SIZES)},
  "type": string,
  "subtype": string or null,
  "alignment": string,
  "ac": number or string like "16 (natural armor)",
  "hp": number,
  "hit_dice": string like "11d10+44",
  "speed": string,
  "stats": [STR, DEX, CON, INT, WIS, CHA] six integers,
  "saves": [{"strength": 6}] array of single-key objects (empty if none),
  "skills": [{"athletics": 6}] array of single-key objects (empty if none),
  "damage_vulnerabilities": string or null,
  "damage_resistances": string or null,
  "damage_immunities": string or null,
  "condition_immunities": string or null,
  "senses": string,
  "languages": string,
  "cr": string (use "${cr}" unless the description strongly demands otherwise),
  "spells": [{"name": string, "desc": string}],
  "traits": [{"name": string, "desc": string}],
  "actions": [{"name": string, "desc": string}],
  "reactions": [{"name": string, "desc": string}],
  "legendary_actions": [{"name": string, "desc": string}],
  "habitat": one of ${JSON.stringify(HABITATS)},
  "archetype": one of ${JSON.stringify(ARCHETYPES)},
  "locomotion": array from ${JSON.stringify(LOCOMOTIONS)},
  "group": one of ${JSON.stringify(GROUPS)},
  "personality": one of ${JSON.stringify(PERSONALITIES)},
  "lore": string,
  "tactics": string,
  "drops": string
}

Target encounter: party of ${input.partySize} level-${input.characterLevel} characters, difficulty ${input.difficulty} (XP budget ${budget}).
Suggested CR ${cr}. Typical stats for that CR: AC ${cal.ac}, HP ${cal.hp}, attack bonus +${cal.attack}, damage/round ${cal.damage}, save DC ${cal.saveDc}.
Action text must use 5e phrasing, e.g. "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 12 (2d6 + 3) slashing damage."
Do not use the word "none"; use empty arrays or null.
Legendary actions only if CR is 5+ and the description warrants a boss.

Monster name: ${input.name}
Description: ${input.description}
Allowed difficulties for context: ${DIFFICULTIES.join(', ')}`
}

export async function generateStatblock(input: {
  name: string
  partySize: number
  characterLevel: number
  difficulty: Difficulty
  description: string
}) {
  const prompt = buildPrompt(input)
  const messages = [
    { role: 'system', content: 'You output valid JSON only. No markdown.' },
    { role: 'user', content: prompt },
  ]
  let lastError = 'All free models failed'
  for (const model of STATBLOCK_MODELS) {
    try {
      const content = await complete(model, messages)
      const parsed = extractJson(content)
      const monster = generatedMonsterSchema.parse(parsed)
      return { monster, model }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      if (lastError.toLowerCase().includes('json')) {
        try {
          const repair = await complete(model, [
            ...messages,
            { role: 'assistant', content: lastError },
            { role: 'user', content: 'Fix the JSON so it matches the schema exactly. JSON only.' },
          ])
          const monster = generatedMonsterSchema.parse(extractJson(repair))
          return { monster, model }
        } catch (repairError) {
          lastError = repairError instanceof Error ? repairError.message : String(repairError)
        }
      }
    }
  }
  throw new Error(lastError)
}
