import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GEMINI_RETRY_DELAY_MS, generateStatblock } from './statblock.ts'
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

  it('uses Google AI Studio Gemini 3.5 Flash when GEMINI_API_KEY is present', async () => {
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
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('gemini-3.5-flash')
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
    expect(result.model).toBe('gemini-3.5-flash')
    expect(result.monster.name).toBe('Cinder Drake')
    // Verify Gemini was called
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('generativelanguage.googleapis.com')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('gemini-3.5-flash')
    // Verify OpenRouter was NOT called because Gemini quota was not exceeded
    const calledOpenRouter = fetchMock.mock.calls.some((call) =>
      String(call[0]).includes('openrouter.ai'),
    )
    expect(calledOpenRouter).toBe(false)
  })

  it('tries next Gemini model before falling back to OpenRouter when primary Gemini model hits quota limit (429)', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('gemini-3.5-flash')) {
        return new Response('Quota exceeded (RESOURCE_EXHAUSTED)', { status: 429 })
      }
      if (href.includes('gemini-flash-latest')) {
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
    expect(result.model).toBe('gemini-flash-latest')
    expect(result.monster.name).toBe('Cinder Drake')
    // Primary Gemini was attempted first and failed with quota limit
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('gemini-3.5-flash')
    // Secondary Gemini was attempted and succeeded before falling back to OpenRouter
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('gemini-flash-latest')
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
    expect(result.model).toBe('gemini-3.5-flash')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries a Gemini model after a temporary 503 instead of falling back to OpenRouter', async () => {
    let geminiAttempts = 0
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('generativelanguage.googleapis.com')) {
        geminiAttempts++
        if (geminiAttempts === 1) {
          return new Response('This model is currently experiencing high demand.', { status: 503 })
        }
        return jsonResponse({
          candidates: [{ content: { parts: [{ text: JSON.stringify(validMonster) }] } }],
        })
      }
      return jsonResponse({ choices: [{ message: { content: JSON.stringify(validMonster) } }] })
    })
    const sleep = vi.fn(async () => {})

    const result = await generateStatblock(input, {
      env: {
        GEMINI_API_KEY: 'test-gemini-key',
        OPENROUTER_API_KEY: 'test-openrouter-key',
      },
      fetch: fetchMock,
      sleep,
    })

    expect(result.provider).toBe('gemini')
    expect(result.model).toBe('gemini-3.5-flash')
    expect(sleep).toHaveBeenCalledWith(GEMINI_RETRY_DELAY_MS)
    const urls = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(urls).toHaveLength(2)
    expect(urls.every((url) => url.includes('/models/gemini-3.5-flash:'))).toBe(true)
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
      if (href.includes('/models/gemini-3.5-flash:')) {
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
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('gemini-3.5-flash')
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
