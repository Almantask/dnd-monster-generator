import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GEMINI_PHASE_BUDGET_MS, GEMINI_RETRY_DELAY_MS, generateStatblock } from './statblock.ts'
import { clearGeminiQuota, isGeminiQuotaExceeded, markGeminiQuotaExceeded } from './quota.ts'
import type { Difficulty } from '../shared/taxonomies.ts'

const validMonster = {
  name: 'Cinder Drake',
  size: 'Medium',
  type: 'dragon',
  subtype: null,
  alignment: 'chaotic evil',
  ac: '15 (natural armor)',
  hp: 45,
  hit_dice: '6d8+18',
  speed: '30 ft., fly 60 ft.',
  stats: [16, 14, 16, 8, 12, 10],
  saves: [{ dexterity: 4 }],
  skills: [{ perception: 3 }],
  damage_vulnerabilities: 'cold',
  damage_resistances: null,
  damage_immunities: 'fire',
  condition_immunities: null,
  senses: 'darkvision 60 ft., passive Perception 13',
  languages: 'Draconic',
  cr: '3',
  spells: [],
  traits: [
    {
      name: 'Heated Body',
      desc: 'A creature that touches the drake takes 3 (1d6) fire damage.',
    },
  ],
  actions: [
    {
      name: 'Bite',
      desc: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 8 (1d10 + 3) piercing damage plus 3 (1d6) fire damage.',
    },
  ],
  reactions: [],
  legendary_actions: [],
  habitat: 'Mountain',
  archetype: 'Skirmisher',
  locomotion: ['Terrestrial', 'Flying'],
  group: 'Solo',
  personality: 'Aggressive',
  lore: 'Born from volcanic fissures.',
  tactics: 'Strikes from above with breath weapon and fiery claws.',
  drops: 'Molten scale, drake heart',
}

const input = {
  name: 'Cinder Drake',
  partySize: 4,
  characterLevel: 3,
  difficulty: 'medium' as Difficulty,
  description: 'A winged dragonet glowing with embers.',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('generateStatblock', () => {
  beforeEach(() => {
    clearGeminiQuota()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearGeminiQuota()
  })

  it('uses the strongest Google AI Studio Gemini model when GEMINI_API_KEY is present', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('generativelanguage.googleapis.com')) {
        return jsonResponse({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(validMonster) }],
              },
            },
          ],
        })
      }
      return new Response('unexpected', { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateStatblock(input, { env: { GEMINI_API_KEY: 'test-gemini-key' } })

    expect(result.provider).toBe('gemini')
    expect(result.monster.name).toBe('Cinder Drake')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('gemini-3.8-flash')
  })

  it('sends the 5e arithmetic rules and leaves Gemini thinking uncapped', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
      if (String(url).includes('generativelanguage.googleapis.com')) {
        return jsonResponse({
          candidates: [{ content: { parts: [{ text: JSON.stringify(validMonster) }] } }],
        })
      }
      return new Response('unexpected', { status: 500 })
    })

    await generateStatblock(input, { env: { GEMINI_API_KEY: 'test-gemini-key' }, fetch: fetchMock })

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    // An explicit budget caps dynamic thinking, so the request must not set one.
    expect(body.generationConfig.thinkingConfig).toBeUndefined()
    const sentPrompt = String(body.contents[0].parts[0].text)
    expect(sentPrompt).toContain('Proficiency bonus by CR')
    expect(sentPrompt).toContain('Save DC = 8 + proficiency bonus')
  })

  it('stops trying Gemini models once the phase time budget is spent', async () => {
    let clock = 0
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('generativelanguage.googleapis.com')) {
        clock += GEMINI_PHASE_BUDGET_MS // a slow model eats the whole budget
        return new Response('high demand', { status: 503 })
      }
      return jsonResponse({ choices: [{ message: { content: JSON.stringify(validMonster) } }] })
    })

    const result = await generateStatblock(input, {
      env: { GEMINI_API_KEY: 'test-gemini-key', OPENROUTER_API_KEY: 'test-openrouter-key' },
      fetch: fetchMock,
      sleep: async () => {},
      now: () => clock,
    })

    expect(result.provider).toBe('openrouter')
    // One slow model spends the budget; the remaining five are skipped.
    const geminiUrls = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .filter((url) => url.includes('generativelanguage.googleapis.com'))
    expect(geminiUrls).toHaveLength(1)
  })

  it('falls back to OpenRouter when GEMINI_API_KEY is not set but OPENROUTER_API_KEY is', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('openrouter.ai')) {
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify(validMonster),
              },
            },
          ],
        })
      }
      return new Response('unexpected', { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateStatblock(input, {
      env: { OPENROUTER_API_KEY: 'test-openrouter-key' },
    })

    expect(result.provider).toBe('openrouter')
    expect(result.monster.name).toBe('Cinder Drake')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('openrouter.ai')
  })

  it('uses Gemini before quota is exceeded when both Gemini and OpenRouter are configured', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('generativelanguage.googleapis.com')) {
        return jsonResponse({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(validMonster) }],
              },
            },
          ],
        })
      }
      return new Response('unexpected', { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateStatblock(input, {
      env: {
        GEMINI_API_KEY: 'test-gemini-key',
        OPENROUTER_API_KEY: 'test-openrouter-key',
      },
    })

    expect(result.provider).toBe('gemini')
    expect(result.model).toBe('gemini-3.8-flash')
    expect(result.monster.name).toBe('Cinder Drake')
    // Verify Gemini was called
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('generativelanguage.googleapis.com')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('gemini-3.8-flash')
    // Verify OpenRouter was NOT called because Gemini quota was not exceeded
    const calledOpenRouter = fetchMock.mock.calls.some((call) =>
      String(call[0]).includes('openrouter.ai'),
    )
    expect(calledOpenRouter).toBe(false)
  })

  it('tries next Gemini model before falling back to OpenRouter when primary Gemini model hits quota limit (429)', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('gemini-3.8-flash')) {
        return new Response('Quota exceeded (RESOURCE_EXHAUSTED)', { status: 429 })
      }
      if (href.includes('gemini-3.7-flash')) {
        return jsonResponse({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(validMonster) }],
              },
            },
          ],
        })
      }
      return new Response('unexpected', { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateStatblock(input, {
      env: {
        GEMINI_API_KEY: 'test-gemini-key',
        OPENROUTER_API_KEY: 'test-openrouter-key',
      },
    })

    expect(result.provider).toBe('gemini')
    expect(result.model).toBe('gemini-3.7-flash')
    expect(result.monster.name).toBe('Cinder Drake')
    // Primary Gemini was attempted first and failed with quota limit
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('gemini-3.8-flash')
    // Secondary Gemini was attempted and succeeded before falling back to OpenRouter
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('gemini-3.7-flash')
    // OpenRouter was NOT called because a Gemini model succeeded
    const calledOpenRouter = fetchMock.mock.calls.some((call) =>
      String(call[0]).includes('openrouter.ai'),
    )
    expect(calledOpenRouter).toBe(false)
  })

  it('keeps a Gemini statblock whose JSON is followed by a stray brace or split across parts', async () => {
    const json = JSON.stringify(validMonster, null, 2)
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('generativelanguage.googleapis.com')) {
        return jsonResponse({
          candidates: [
            {
              content: {
                parts: [
                  { text: 'planning the monster', thought: true },
                  { text: json.slice(0, 100) },
                  { text: `${json.slice(100)}\n}` },
                ],
              },
            },
          ],
        })
      }
      return jsonResponse({ choices: [{ message: { content: JSON.stringify(validMonster) } }] })
    })

    const result = await generateStatblock(input, {
      env: { GEMINI_API_KEY: 'test-gemini-key', OPENROUTER_API_KEY: 'test-openrouter-key' },
      fetch: fetchMock,
    })

    expect(result.provider).toBe('gemini')
    expect(result.model).toBe('gemini-3.8-flash')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('moves to the next Gemini model on a temporary 503 instead of falling back to OpenRouter', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('/models/gemini-3.8-flash:')) {
        return new Response('This model is currently experiencing high demand.', { status: 503 })
      }
      if (href.includes('generativelanguage.googleapis.com')) {
        return jsonResponse({
          candidates: [{ content: { parts: [{ text: JSON.stringify(validMonster) }] } }],
        })
      }
      return jsonResponse({ choices: [{ message: { content: JSON.stringify(validMonster) } }] })
    })
    const sleep = vi.fn(async () => {})

    const result = await generateStatblock(input, {
      env: { GEMINI_API_KEY: 'test-gemini-key', OPENROUTER_API_KEY: 'test-openrouter-key' },
      fetch: fetchMock,
      sleep,
    })

    expect(result.provider).toBe('gemini')
    expect(result.model).toBe('gemini-3.7-flash')
    // A busy model is abandoned at once; the next model is the faster retry.
    expect(sleep).not.toHaveBeenCalled()
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toHaveLength(2)
  })

  it('retries the last Gemini model once before giving up on Gemini', async () => {
    let lastModelAttempts = 0
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('/models/gemini-3.5-flash-lite:')) {
        lastModelAttempts++
        if (lastModelAttempts === 1) {
          return new Response('high demand', { status: 503 })
        }
        return jsonResponse({
          candidates: [{ content: { parts: [{ text: JSON.stringify(validMonster) }] } }],
        })
      }
      if (href.includes('generativelanguage.googleapis.com')) {
        return new Response('high demand', { status: 503 })
      }
      return jsonResponse({ choices: [{ message: { content: JSON.stringify(validMonster) } }] })
    })
    const sleep = vi.fn(async () => {})

    const result = await generateStatblock(input, {
      env: { GEMINI_API_KEY: 'test-gemini-key', OPENROUTER_API_KEY: 'test-openrouter-key' },
      fetch: fetchMock,
      sleep,
    })

    expect(result.provider).toBe('gemini')
    expect(result.model).toBe('gemini-3.5-flash-lite')
    expect(lastModelAttempts).toBe(2)
    expect(sleep).toHaveBeenCalledWith(GEMINI_RETRY_DELAY_MS)
  })

  it('does not skip Gemini on the next request when only some Gemini models hit quota', async () => {
    const env = {
      GEMINI_API_KEY: 'test-gemini-key',
      OPENROUTER_API_KEY: 'test-openrouter-key',
    }
    const openRouterOk = () =>
      jsonResponse({ choices: [{ message: { content: JSON.stringify(validMonster) } }] })
    const firstFetch = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('/models/gemini-3.8-flash:')) {
        return new Response('Quota exceeded (RESOURCE_EXHAUSTED)', { status: 429 })
      }
      if (href.includes('generativelanguage.googleapis.com')) {
        return new Response('high demand', { status: 503 })
      }
      return openRouterOk()
    })

    const first = await generateStatblock(input, { env, fetch: firstFetch, sleep: async () => {} })

    expect(first.provider).toBe('openrouter')
    expect(isGeminiQuotaExceeded()).toBe(false)

    const secondFetch = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('generativelanguage.googleapis.com')) {
        return jsonResponse({
          candidates: [{ content: { parts: [{ text: JSON.stringify(validMonster) }] } }],
        })
      }
      return openRouterOk()
    })

    const second = await generateStatblock(input, { env, fetch: secondFetch })

    expect(second.provider).toBe('gemini')
  })

  it('never calls Gemini models that Google has retired for new keys', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('generativelanguage.googleapis.com')) {
        return new Response('Quota exceeded (RESOURCE_EXHAUSTED)', { status: 429 })
      }
      return jsonResponse({ choices: [{ message: { content: JSON.stringify(validMonster) } }] })
    })

    await generateStatblock(input, {
      env: { GEMINI_API_KEY: 'test-gemini-key', OPENROUTER_API_KEY: 'test-openrouter-key' },
      fetch: fetchMock,
    })

    const urls = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(urls.some((url) => /\/models\/gemini-2\.[05]-flash:/.test(url))).toBe(false)
  })

  it('falls back to OpenRouter only after Gemini quota is exceeded across all Gemini models (429)', async () => {
    const callOrder: string[] = []
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('generativelanguage.googleapis.com')) {
        callOrder.push(href)
        return new Response('Quota exceeded (RESOURCE_EXHAUSTED)', { status: 429 })
      }
      if (href.includes('openrouter.ai')) {
        callOrder.push(href)
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify(validMonster),
              },
            },
          ],
        })
      }
      return new Response('unexpected', { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateStatblock(input, {
      env: {
        GEMINI_API_KEY: 'test-gemini-key',
        OPENROUTER_API_KEY: 'test-openrouter-key',
      },
    })

    expect(result.provider).toBe('openrouter')
    expect(result.monster.name).toBe('Cinder Drake')

    // Confirm Gemini was called for each Gemini model before falling back to OpenRouter
    const geminiCalls = callOrder.filter((url) => url.includes('generativelanguage.googleapis.com'))
    const openRouterCalls = callOrder.filter((url) => url.includes('openrouter.ai'))

    expect(geminiCalls.length).toBeGreaterThanOrEqual(5)
    expect(openRouterCalls.length).toBe(1)

    // Verify all Gemini calls happened BEFORE any OpenRouter call
    const firstOpenRouterIdx = callOrder.findIndex((url) => url.includes('openrouter.ai'))
    expect(firstOpenRouterIdx).toBe(geminiCalls.length)
  })

  it('prioritizes configured GEMINI_STATBLOCK_MODEL override before its quota is exceeded', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('custom-gemini-model')) {
        return jsonResponse({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(validMonster) }],
              },
            },
          ],
        })
      }
      return new Response('unexpected', { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateStatblock(input, {
      env: {
        GEMINI_API_KEY: 'test-gemini-key',
        OPENROUTER_API_KEY: 'test-openrouter-key',
        GEMINI_STATBLOCK_MODEL: 'custom-gemini-model',
      },
    })

    expect(result.provider).toBe('gemini')
    expect(result.model).toBe('custom-gemini-model')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('custom-gemini-model')
    const calledOpenRouter = fetchMock.mock.calls.some((call) =>
      String(call[0]).includes('openrouter.ai'),
    )
    expect(calledOpenRouter).toBe(false)
  })

  it('throws an error when Gemini quota is exceeded (429) and no fallback provider is configured', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('generativelanguage.googleapis.com')) {
        return new Response('Quota exceeded (RESOURCE_EXHAUSTED)', { status: 429 })
      }
      return new Response('unexpected', { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      generateStatblock(input, {
        env: { GEMINI_API_KEY: 'test-gemini-key' },
      }),
    ).rejects.toThrow(/Statblock generation failed on all configured providers/)
  })

  it('routes directly to OpenRouter during active quota cooldown after Gemini quota was exceeded', async () => {
    markGeminiQuotaExceeded(60_000)

    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('openrouter.ai')) {
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify(validMonster),
              },
            },
          ],
        })
      }
      return new Response('unexpected', { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateStatblock(input, {
      env: {
        GEMINI_API_KEY: 'test-gemini-key',
        OPENROUTER_API_KEY: 'test-openrouter-key',
      },
    })

    expect(result.provider).toBe('openrouter')
    expect(result.monster.name).toBe('Cinder Drake')
    // During active cooldown, Gemini was not called
    const calledGemini = fetchMock.mock.calls.some((call) =>
      String(call[0]).includes('generativelanguage.googleapis.com'),
    )
    expect(calledGemini).toBe(false)
  })

  it('resumes using Gemini once quota cooldown period expires', async () => {
    // Set quota exceeded with a negative offset so cooldown has already expired
    markGeminiQuotaExceeded(10_000, Date.now() - 20_000)

    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('generativelanguage.googleapis.com')) {
        return jsonResponse({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(validMonster) }],
              },
            },
          ],
        })
      }
      return new Response('unexpected', { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateStatblock(input, {
      env: {
        GEMINI_API_KEY: 'test-gemini-key',
        OPENROUTER_API_KEY: 'test-openrouter-key',
      },
    })

    expect(result.provider).toBe('gemini')
    expect(result.monster.name).toBe('Cinder Drake')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('gemini-3.8-flash')
    const calledOpenRouter = fetchMock.mock.calls.some((call) =>
      String(call[0]).includes('openrouter.ai'),
    )
    expect(calledOpenRouter).toBe(false)
  })

  it('throws an informative error when no API keys are configured', async () => {
    await expect(generateStatblock(input, { env: {} })).rejects.toThrow(
      /Neither GEMINI_API_KEY nor OPENROUTER_API_KEY is configured/,
    )
  })
})
