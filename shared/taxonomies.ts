export const SIZES = [
  'Tiny',
  'Small',
  'Medium',
  'Large',
  'Huge',
  'Gargantuan',
] as const

export const HABITATS = [
  'Arctic',
  'Coastal',
  'Desert',
  'Forest',
  'Grassland',
  'Hill',
  'Mountain',
  'Swamp',
  'Underdark',
  'Underwater',
  'Urban',
  'Extra-planar',
  'Any',
] as const

export const ARCHETYPES = [
  'Brute',
  'Soldier',
  'Skirmisher',
  'Artillery',
  'Controller',
  'Lurker',
  'Leader',
  'Support',
  'Boss',
] as const

export const LOCOMOTIONS = ['Terrestrial', 'Flying', 'Aquatic'] as const

export const GROUPS = ['Solo', 'Group', 'Swarm'] as const

export const PERSONALITIES = [
  'Aggressive',
  'Cunning',
  'Territorial',
  'Cowardly',
  'Honorable',
  'Sadistic',
  'Curious',
  'Protective',
  'Feral',
  'Calculating',
  'Proud',
  'Servile',
] as const

export const ALIGNMENTS = [
  'lawful good',
  'neutral good',
  'chaotic good',
  'lawful neutral',
  'neutral',
  'chaotic neutral',
  'lawful evil',
  'neutral evil',
  'chaotic evil',
  'unaligned',
] as const

export const DIFFICULTIES = [
  'very easy',
  'easy',
  'medium',
  'hard',
  'very hard',
  'deadly',
] as const

export const ABILITIES = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
] as const

export const ABILITY_ABBREV = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const

export type Size = (typeof SIZES)[number]
export type Habitat = (typeof HABITATS)[number]
export type Archetype = (typeof ARCHETYPES)[number]
export type Locomotion = (typeof LOCOMOTIONS)[number]
export type GroupType = (typeof GROUPS)[number]
export type Personality = (typeof PERSONALITIES)[number]
export type Alignment = (typeof ALIGNMENTS)[number]
export type Difficulty = (typeof DIFFICULTIES)[number]
export type Ability = (typeof ABILITIES)[number]
