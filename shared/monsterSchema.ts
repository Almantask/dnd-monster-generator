import { z } from 'zod'
import {
  ARCHETYPES,
  GROUPS,
  HABITATS,
  LOCOMOTIONS,
  PERSONALITIES,
  SIZES,
} from './taxonomies.ts'

export const namedFeatureSchema = z.object({
  name: z.string(),
  desc: z.string(),
})

export const bonusMapSchema = z.array(z.record(z.string(), z.number()))

export const monsterSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  size: z.enum(SIZES),
  type: z.string().min(1),
  subtype: z.string().nullable(),
  alignment: z.string().min(1),
  ac: z.union([z.number(), z.string()]),
  hp: z.number(),
  hit_dice: z.string(),
  speed: z.string(),
  stats: z.tuple([
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
  ]),
  saves: bonusMapSchema,
  skills: bonusMapSchema,
  damage_vulnerabilities: z.string().nullable(),
  damage_resistances: z.string().nullable(),
  damage_immunities: z.string().nullable(),
  condition_immunities: z.string().nullable(),
  senses: z.string(),
  languages: z.string(),
  cr: z.string(),
  spells: z.array(namedFeatureSchema),
  traits: z.array(namedFeatureSchema),
  actions: z.array(namedFeatureSchema),
  reactions: z.array(namedFeatureSchema),
  legendary_actions: z.array(namedFeatureSchema),
  habitat: z.enum(HABITATS),
  archetype: z.enum(ARCHETYPES),
  locomotion: z.array(z.enum(LOCOMOTIONS)),
  group: z.enum(GROUPS),
  personality: z.enum(PERSONALITIES),
  lore: z.string(),
  tactics: z.string(),
  drops: z.string(),
  imageBlobId: z.string().nullable(),
  source: z.enum(['ai', 'manual']),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type Monster = z.infer<typeof monsterSchema>
export type NamedFeature = z.infer<typeof namedFeatureSchema>

export const exportWrapperSchema = z.object({
  schemaVersion: z.literal(1),
  monster: monsterSchema,
  image: z
    .object({
      mime: z.string(),
      dataUrl: z.string(),
    })
    .nullable()
    .optional(),
})

export type ExportWrapper = z.infer<typeof exportWrapperSchema>

export const generatedMonsterSchema = monsterSchema.omit({
  id: true,
  imageBlobId: true,
  source: true,
  createdAt: true,
  updatedAt: true,
})

export type GeneratedMonster = z.infer<typeof generatedMonsterSchema>
