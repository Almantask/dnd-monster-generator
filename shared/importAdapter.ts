import { generatedMonsterSchema, monsterSchema } from './monsterSchema.ts'
import type { Monster, NamedFeature } from './monsterSchema.ts'
import {
  ARCHETYPES,
  GROUPS,
  HABITATS,
  LOCOMOTIONS,
  PERSONALITIES,
  SIZES,
  type Ability,
  type Archetype,
  type GroupType,
  type Habitat,
  type Locomotion,
  type Personality,
  type Size,
} from './taxonomies.ts'

const ABILITY_ALIASES: Record<string, Ability> = {
  str: 'strength',
  strength: 'strength',
  dex: 'dexterity',
  dexterity: 'dexterity',
  con: 'constitution',
  constitution: 'constitution',
  int: 'intelligence',
  intelligence: 'intelligence',
  wis: 'wisdom',
  wisdom: 'wisdom',
  cha: 'charisma',
  charisma: 'charisma',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback
  return String(value)
}

function emptyToNull(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  if (!text || text.toLowerCase() === 'none') return null
  return text
}

function normalizeFeatures(value: unknown): NamedFeature[] {
  if (!value) return []
  if (!Array.isArray(value)) return []
  const features: NamedFeature[] = []
  for (const item of value) {
    if (typeof item === 'string') {
      if (item.trim().toLowerCase() === 'none' || !item.trim()) continue
      features.push({ name: item, desc: '' })
      continue
    }
    if (isRecord(item) && typeof item.name === 'string') {
      features.push({
        name: item.name,
        desc: typeof item.desc === 'string' ? item.desc : '',
      })
    }
  }
  return features
}

function normalizeBonusMaps(value: unknown): Array<Record<string, number>> {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const next: Record<string, number> = {}
    for (const [key, raw] of Object.entries(item)) {
      const ability = ABILITY_ALIASES[key.toLowerCase()]
      const name = ability ?? key
      const num = typeof raw === 'number' ? raw : Number(raw)
      if (Number.isFinite(num)) next[name] = num
    }
    return Object.keys(next).length ? [next] : []
  })
}

function pickEnum<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
): T {
  if (typeof value !== 'string') return fallback
  const lower = value.toLowerCase()
  const match = options.find((option) => option.toLowerCase() === lower)
  return match ?? fallback
}

function normalizeSize(value: unknown): Size {
  return pickEnum(value, SIZES, 'Medium')
}

function normalizeLocomotion(raw: unknown, speed: string): Locomotion[] {
  if (Array.isArray(raw) && raw.length) {
    const picked = raw
      .map((item) => pickEnum(item, LOCOMOTIONS, 'Terrestrial'))
      .filter((item, index, all) => all.indexOf(item) === index)
    return picked.length ? picked : ['Terrestrial']
  }
  const found: Locomotion[] = ['Terrestrial']
  const lower = speed.toLowerCase()
  if (lower.includes('fly')) found.push('Flying')
  if (lower.includes('swim')) found.push('Aquatic')
  return found
}

function unwrap(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (isRecord(payload) && payload.schemaVersion === 1 && payload.monster) {
    return [payload]
  }
  if (isRecord(payload) && Array.isArray(payload.monsters)) return payload.monsters
  return [payload]
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `m_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export type ImportedFile = {
  monster: Monster
  image?: { mime: string; dataUrl: string } | null
}

export function importPayload(payload: unknown): ImportedFile[] {
  const items = unwrap(payload)
  return items.map((item) => {
    if (isRecord(item) && item.schemaVersion === 1 && isRecord(item.monster)) {
      const monster = monsterSchema.parse({
        ...defaultsFromRaw(item.monster),
        ...item.monster,
      })
      const image =
        isRecord(item.image) &&
        typeof item.image.mime === 'string' &&
        typeof item.image.dataUrl === 'string'
          ? { mime: item.image.mime, dataUrl: item.image.dataUrl }
          : null
      return { monster, image }
    }
    const monster = monsterFromRaw(item)
    return { monster, image: null }
  })
}

function defaultsFromRaw(raw: Record<string, unknown>): Monster {
  const now = new Date().toISOString()
  const speed = asString(raw.speed, '30 ft.')
  return {
    id: typeof raw.id === 'string' ? raw.id : newId(),
    name: asString(raw.name, 'Unnamed Monster'),
    size: normalizeSize(raw.size),
    type: asString(raw.type, 'monstrosity'),
    subtype: emptyToNull(raw.subtype),
    alignment: asString(raw.alignment, 'unaligned'),
    ac: typeof raw.ac === 'number' || typeof raw.ac === 'string' ? raw.ac : 10,
    hp: typeof raw.hp === 'number' ? raw.hp : Number(raw.hp) || 1,
    hit_dice: asString(raw.hit_dice, '1d8'),
    speed,
    stats: normalizeStats(raw.stats),
    saves: normalizeBonusMaps(raw.saves),
    skills: normalizeBonusMaps(raw.skills ?? raw.skillsaves),
    damage_vulnerabilities: emptyToNull(raw.damage_vulnerabilities),
    damage_resistances: emptyToNull(raw.damage_resistances),
    damage_immunities: emptyToNull(raw.damage_immunities),
    condition_immunities: emptyToNull(raw.condition_immunities),
    senses: asString(raw.senses, 'passive Perception 10'),
    languages: asString(raw.languages, '—'),
    cr: asString(raw.cr, '0'),
    spells: normalizeFeatures(raw.spells),
    traits: normalizeFeatures(raw.traits),
    actions: normalizeFeatures(raw.actions),
    reactions: normalizeFeatures(raw.reactions),
    legendary_actions: normalizeFeatures(raw.legendary_actions),
    habitat: pickEnum(raw.habitat, HABITATS, 'Any'),
    archetype: pickEnum(raw.archetype, ARCHETYPES, 'Brute'),
    locomotion: normalizeLocomotion(raw.locomotion, speed),
    group: pickEnum(raw.group, GROUPS, 'Solo'),
    personality: pickEnum(raw.personality, PERSONALITIES, 'Aggressive'),
    lore: asString(raw.lore),
    tactics: asString(raw.tactics),
    drops: asString(raw.drops),
    imageBlobId: typeof raw.imageBlobId === 'string' ? raw.imageBlobId : null,
    source: raw.source === 'ai' ? 'ai' : 'manual',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
  }
}

function normalizeStats(value: unknown): Monster['stats'] {
  if (Array.isArray(value) && value.length >= 6) {
    return [
      Number(value[0]) || 10,
      Number(value[1]) || 10,
      Number(value[2]) || 10,
      Number(value[3]) || 10,
      Number(value[4]) || 10,
      Number(value[5]) || 10,
    ]
  }
  return [10, 10, 10, 10, 10, 10]
}

export function monsterFromRaw(raw: unknown): Monster {
  if (!isRecord(raw)) {
    throw new Error('Monster JSON must be an object')
  }
  return monsterSchema.parse(defaultsFromRaw(raw))
}

export function assertGenerated(raw: unknown) {
  return generatedMonsterSchema.parse(raw)
}

export function createBlankMonster(): Monster {
  const now = new Date().toISOString()
  return monsterSchema.parse({
    id: newId(),
    name: 'Unnamed monster',
    size: 'Medium',
    type: 'humanoid',
    subtype: null,
    alignment: 'unaligned',
    ac: 10,
    hp: 10,
    hit_dice: '2d8',
    speed: '30 ft.',
    stats: [10, 10, 10, 10, 10, 10],
    saves: [],
    skills: [],
    damage_vulnerabilities: null,
    damage_resistances: null,
    damage_immunities: null,
    condition_immunities: null,
    senses: 'passive Perception 10',
    languages: 'Common',
    cr: '1',
    spells: [],
    traits: [],
    actions: [],
    reactions: [],
    legendary_actions: [],
    habitat: 'Any',
    archetype: 'Brute',
    locomotion: ['Terrestrial'],
    group: 'Solo',
    personality: 'Aggressive',
    lore: '',
    tactics: '',
    drops: '',
    imageBlobId: null,
    source: 'manual',
    createdAt: now,
    updatedAt: now,
  })
}

export function withIdentity(
  generated: ReturnType<typeof assertGenerated>,
  source: Monster['source'],
): Monster {
  const now = new Date().toISOString()
  return monsterSchema.parse({
    ...generated,
    id: newId(),
    imageBlobId: null,
    source,
    createdAt: now,
    updatedAt: now,
  })
}

export type { Habitat, Archetype, Locomotion, GroupType, Personality }
