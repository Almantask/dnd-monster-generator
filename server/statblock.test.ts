import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateStatblock } from './statblock.ts'
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
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses Google AI Studio Gemini 2.5 Flash when GEMINI_API_KEY is present', async () => {
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
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('gemini-2.5-flash')
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

  it('throws an informative error when no API keys are configured', async () => {
    await expect(generateStatblock(input, { env: {} })).rejects.toThrow(
      /Neither GEMINI_API_KEY nor OPENROUTER_API_KEY is configured/,
    )
  })
})
