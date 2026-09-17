import { GEMINI_STATBLOCK_MODELS, OPENROUTER_STATBLOCK_MODELS } from '../shared/aiModels.ts'
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
import { generatedMonsterSchema, type GeneratedMonster } from '../shared/monsterSchema.ts'
import {
  calibrationFor,
  encounterBudget,
  suggestChallengeRating,
} from '../shared/encounterBudget.ts'
import {
  clearGeminiQuota,
  isGeminiQuotaExceeded,
  isQuotaError,
  markGeminiQuotaExceeded,
} from './quota.ts'

export type StatblockRuntime = {
  env?: NodeJS.Dict<string>
  fetch?: typeof globalThis.fetch
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

/** Google returns 503 "high demand" spikes that usually clear within seconds. */
const GEMINI_TRANSIENT_STATUSES = new Set([500, 502, 503, 504])
export const GEMINI_RETRY_DELAY_MS = 2_000
/**
 * Gemini 3.x models think dynamically by default (measured: ~1,500 thought tokens on a statblock
 * prompt). An explicit thinkingConfig budget only caps that, so none is sent.
 */
export const GEMINI_REQUEST_TIMEOUT_MS = 45_000
/**
 * Ceiling for the whole Gemini phase. Six models, each with a retry, can otherwise outlast
 * Cloud Run's 120s request timeout and leave no room for the OpenRouter fallback.
 */
export const GEMINI_PHASE_BUDGET_MS = 75_000

class GeminiApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

function envOf(runtime?: StatblockRuntime) {
  return runtime?.env ?? process.env
}

function fetchOf(runtime?: StatblockRuntime) {
  return runtime?.fetch ?? globalThis.fetch
}

function nowOf(runtime?: StatblockRuntime) {
  return runtime?.now ?? Date.now
}

function sleepOf(runtime?: StatblockRuntime) {
  return runtime?.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)))
}

function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const raw = fenced?.[1] ?? text
  const start = raw.indexOf('{')
  if (start === -1) throw new Error('No JSON object in model response')
  // Parse only the first balanced object: Gemini 3.x sometimes appends a stray `}` after valid JSON.
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
    } else if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) return JSON.parse(raw.slice(start, i + 1)) as unknown
  }
  throw new Error('Unterminated JSON object in model response')
}

async function completeGemini(
  model: string,
  prompt: string,
  runtime?: StatblockRuntime,
  timeoutMs = GEMINI_REQUEST_TIMEOUT_MS,
): Promise<string> {
  const key = envOf(runtime).GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  console.log(`[GEMINI] Calling Google AI Studio with model "${model}" for statblock...`)
  const start = Date.now()
  const res = await fetchOf(runtime)(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: 'You are an expert D&D 5e (2014) monster designer. You return valid JSON only matching the schema exactly with no markdown.',
            },
          ],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    },
  )
  const duration = Date.now() - start
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    console.warn(`[GEMINI] Model "${model}" failed (${res.status}) in ${duration}ms: ${errText}`)
    throw new GeminiApiError(`Gemini ${model} failed (${res.status}): ${errText.slice(0, 200)}`, res.status)
  }
  const data = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string; thought?: boolean }>
      }
    }>
  }
  const content = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => !part.thought)
    .map((part) => part.text ?? '')
    .join('')
  if (!content) {
    console.warn(`[GEMINI] Model "${model}" returned no content in ${duration}ms`)
    throw new Error(`Gemini ${model} returned no content`)
  }
  console.log(`[GEMINI] Received response from "${model}" in ${duration}ms (${content.length} chars)`)
  return content
}

async function completeGeminiWithRetry(
  model: string,
  prompt: string,
  runtime: StatblockRuntime | undefined,
  timeoutMs: number,
  /** Only the last model retries itself; otherwise the next model is the faster retry. */
  retryTransient: boolean,
): Promise<string> {
  try {
    return await completeGemini(model, prompt, runtime, timeoutMs)
  } catch (error) {
    const transient = error instanceof GeminiApiError && GEMINI_TRANSIENT_STATUSES.has(error.status)
    if (!transient || !retryTransient) throw error
    console.warn(`[GEMINI] Model "${model}" temporarily unavailable; retrying in ${GEMINI_RETRY_DELAY_MS}ms...`)
    await sleepOf(runtime)(GEMINI_RETRY_DELAY_MS)
    return completeGemini(model, prompt, runtime, timeoutMs)
  }
}

async function completeOpenRouter(
  model: string,
  messages: { role: string; content: string }[],
  runtime?: StatblockRuntime,
): Promise<string> {
  const key = envOf(runtime).OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY is not set')
  console.log(`[OPENROUTER] Sending request to model "${model}"...`)
  const start = Date.now()
  const res = await fetchOf(runtime)('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': envOf(runtime).PUBLIC_ORIGIN ?? 'https://github.com',
      'X-Title': 'The Bestiary',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(60_000),
  })
  const duration = Date.now() - start
  if (!res.ok) {
    const errText = await res.text()
    console.warn(`[OPENROUTER] Model "${model}" failed (${res.status}) in ${duration}ms: ${errText.slice(0, 300)}`)
    throw new Error(`${model} failed (${res.status}): ${errText.slice(0, 400)}`)
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    console.warn(`[OPENROUTER] Model "${model}" returned no content in ${duration}ms`)
    throw new Error(`${model} returned no content`)
  }
  console.log(`[OPENROUTER] Received response from "${model}" in ${duration}ms (${content.length} chars)`)
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

Work the arithmetic through before answering; every number below must agree:
- Ability modifier = floor((score - 10) / 2).
- Proficiency bonus by CR: +2 (CR 0-4), +3 (5-8), +4 (9-12), +5 (13-16), +6 (17-20).
- Each save and skill = the ability modifier + proficiency bonus.
- Attack bonus = the attacking ability modifier + proficiency bonus, and every "Hit:" average matches its dice (d6 avg 3.5, d8 4.5, d10 5.5, d12 6.5) plus the damage modifier.
- Save DC = 8 + proficiency bonus + the relevant ability modifier.
- hp = the hit_dice average (d8 4.5, d10 5.5, d12 6.5 per die) + CON modifier per die, and hit_dice size matches the creature's size (Small d6, Medium d8, Large d10, Huge d12).
- Passive Perception = 10 + the Perception modifier, and senses must match any blindsight/darkvision the lore implies.
- Traits, actions, spells and locomotion must fit the creature's type, size and habitat, and its damage output per round should land near the CR target above.
Do not use the word "none"; use empty arrays or null.
Legendary actions only if CR is 5+ and the description warrants a boss.

Monster name: ${input.name}
Description: ${input.description}
Allowed difficulties for context: ${DIFFICULTIES.join(', ')}`
}

export async function generateStatblock(
  input: {
    name: string
    partySize: number
    characterLevel: number
    difficulty: Difficulty
    description: string
  },
  runtime?: StatblockRuntime,
): Promise<{ monster: GeneratedMonster; model: string; provider: 'gemini' | 'openrouter' }> {
  const env = envOf(runtime)
  const hasGemini = Boolean(env.GEMINI_API_KEY)
  const hasOpenRouter = Boolean(env.OPENROUTER_API_KEY)

  if (!hasGemini && !hasOpenRouter) {
    throw new Error(
      'Neither GEMINI_API_KEY nor OPENROUTER_API_KEY is configured. Set GEMINI_API_KEY in your .env file.',
    )
  }

  const prompt = buildPrompt(input)
  console.log(`[STATBLOCK] Formulated prompt for "${input.name}" (Length: ${prompt.length} chars)`)

  // 1. Primary: Google AI Studio (Gemini 2.5 Flash / 3.5 Flash)
  const quotaExceeded = isGeminiQuotaExceeded()
  const canUseGemini = hasGemini && (!quotaExceeded || !hasOpenRouter)

  if (canUseGemini) {
    const userGeminiModel = env.GEMINI_STATBLOCK_MODEL?.trim()
    const geminiModels = [
      ...(userGeminiModel ? [userGeminiModel] : []),
      ...GEMINI_STATBLOCK_MODELS,
    ].filter((m, idx, arr) => arr.indexOf(m) === idx)

    let quotaFailures = 0
    let attempted = 0
    const now = nowOf(runtime)
    const deadline = now() + GEMINI_PHASE_BUDGET_MS

    for (let i = 0; i < geminiModels.length; i++) {
      const model = geminiModels[i]!
      const remaining = deadline - now()
      if (attempted > 0 && remaining < 5_000) {
        console.warn(`[STATBLOCK] Gemini time budget spent after ${attempted} model(s); moving on.`)
        break
      }
      attempted++
      console.log(`[STATBLOCK] [${i + 1}/${geminiModels.length}] Trying Google AI Studio Gemini model: "${model}"`)
      try {
        const content = await completeGeminiWithRetry(
          model,
          prompt,
          runtime,
          Math.min(GEMINI_REQUEST_TIMEOUT_MS, Math.max(remaining, 5_000)),
          i === geminiModels.length - 1,
        )
        const parsed = extractJson(content)
        const monster = generatedMonsterSchema.parse(parsed)
        console.log(`[STATBLOCK] ✓ Validated schema successfully with Gemini model: "${model}"`)
        clearGeminiQuota()
        return { monster, model, provider: 'gemini' }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.warn(`[STATBLOCK] Gemini model "${model}" failed: ${msg}`)
        const status = error instanceof GeminiApiError ? error.status : undefined
        if (isQuotaError(status, msg)) quotaFailures++
      }
    }

    // Each model has its own quota; only skip Gemini on later requests when every model is exhausted.
    if (attempted > 0 && quotaFailures === attempted) {
      console.warn('[STATBLOCK] Gemini quota exceeded on every model. Marking quota cooldown...')
      markGeminiQuotaExceeded()
    }
    console.warn('[STATBLOCK] All Gemini models failed. Checking OpenRouter fallback...')
  } else if (hasGemini && hasOpenRouter && quotaExceeded) {
    console.log('[STATBLOCK] Gemini quota currently exceeded (cooldown active). Using OpenRouter fallback...')
  }

  // 2. Fallback: OpenRouter
  if (hasOpenRouter) {
    const messages = [
      { role: 'system', content: 'You output valid JSON only. No markdown.' },
      { role: 'user', content: prompt },
    ]
    const userModel = env.OPENROUTER_MODEL?.trim()
    const candidateModels = [
      ...(userModel ? [userModel] : []),
      ...OPENROUTER_STATBLOCK_MODELS,
    ].filter((m, idx, arr) => arr.indexOf(m) === idx)

    let lastError = 'All OpenRouter models failed'
    for (let i = 0; i < candidateModels.length; i++) {
      const model = candidateModels[i]!
      console.log(`[STATBLOCK] [${i + 1}/${candidateModels.length}] Trying OpenRouter model: "${model}"`)
      try {
        const content = await completeOpenRouter(model, messages, runtime)
        const parsed = extractJson(content)
        const monster = generatedMonsterSchema.parse(parsed)
        console.log(`[STATBLOCK] ✓ Validated schema successfully with OpenRouter model: "${model}"`)
        return { monster, model, provider: 'openrouter' }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        console.warn(`[STATBLOCK] OpenRouter model "${model}" failed: ${lastError}`)
        if (lastError.toLowerCase().includes('json')) {
          try {
            console.log(`[STATBLOCK] Attempting JSON repair prompt with "${model}"...`)
            const repair = await completeOpenRouter(model, [
              ...messages,
              { role: 'assistant', content: lastError },
              { role: 'user', content: 'Fix the JSON so it matches the schema exactly. JSON only.' },
            ], runtime)
            const monster = generatedMonsterSchema.parse(extractJson(repair))
            console.log(`[STATBLOCK] ✓ JSON repair successful with OpenRouter model: "${model}"`)
            return { monster, model, provider: 'openrouter' }
          } catch (repairError) {
            lastError = repairError instanceof Error ? repairError.message : String(repairError)
            console.warn(`[STATBLOCK] JSON repair failed with "${model}": ${lastError}`)
          }
        }
      }
    }
    throw new Error(lastError)
  }

  throw new Error('Statblock generation failed on all configured providers.')
}
