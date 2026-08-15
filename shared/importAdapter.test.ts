import { describe, expect, it } from 'vitest'
import { importPayload } from './importAdapter.ts'

const knight = {
  name: 'Samogitian Knight',
  size: 'Medium',
  type: 'humanoid',
  subtype: 'human',
  alignment: 'chaotic neutral',
  ac: '16 (half plate)',
  hp: 45,
  hit_dice: '6d8+18',
  speed: '30 ft.',
  stats: [18, 14, 14, 10, 12, 12],
  saves: [{ strength: 6 }, { dexterity: 4 }],
  skills: [{ athletics: 6 }, { intimidation: 4 }, { survival: 3 }],
  damage_vulnerabilities: 'none',
  damage_resistances: 'none',
  damage_immunities: 'none',
  condition_immunities: 'none',
  senses: 'passive Perception 11',
  languages: 'Common, Old Samogitian',
  cr: 2,
  spells: ['none'],
  traits: [{ name: 'Ferocious Charge', desc: 'Charge extra damage.' }],
  actions: [{ name: 'Greatsword', desc: 'Melee Weapon Attack: +6 to hit.' }],
  reactions: [{ name: 'Parry', desc: 'Add +2 AC.' }],
  legendary_actions: ['none'],
}

const kaukas = {
  name: 'Kaukas I',
  size: 'Medium',
  type: 'Fey',
  subtype: null,
  alignment: 'Chaotic Neutral',
  ac: 14,
  hp: 28,
  hit_dice: '5d8+5',
  speed: '30 ft.',
  stats: [12, 14, 12, 10, 10, 15],
  saves: [{ DEX: 4 }, { CHA: 4 }],
  skillsaves: [{ Deception: 4 }, { Perception: 2 }, { Stealth: 5 }],
  damage_vulnerabilities: 'Radiant',
  damage_resistances: 'Necrotic',
  damage_immunities: null,
  condition_immunities: null,
  senses: 'Darkvision 60 ft., Passive Perception 12',
  languages: 'Common, Sylvan',
  cr: '1',
  spells: [{ name: 'Grave Sink (Recharge 5-6)', desc: 'Restrain in earth.' }],
  traits: [{ name: 'Tree Refuge', desc: 'Merge into a tree.' }],
  actions: [{ name: 'Grave Claws', desc: 'Melee Weapon Attack: +5 to hit.' }],
  legendary_actions: null,
  reactions: null,
}

describe('importPayload', () => {
  it('normalizes the knight example', () => {
    const [file] = importPayload(knight)
    expect(file.monster.name).toBe('Samogitian Knight')
    expect(file.monster.cr).toBe('2')
    expect(file.monster.spells).toEqual([])
    expect(file.monster.legendary_actions).toEqual([])
    expect(file.monster.damage_vulnerabilities).toBeNull()
    expect(file.monster.actions[0]?.name).toBe('Greatsword')
  })

  it('maps skillsaves and abbreviated saves from the Kaukas example', () => {
    const [file] = importPayload(kaukas)
    expect(file.monster.saves).toEqual([{ dexterity: 4 }, { charisma: 4 }])
    expect(file.monster.skills).toEqual([
      { Deception: 4 },
      { Perception: 2 },
      { Stealth: 5 },
    ])
    expect(file.monster.ac).toBe(14)
    expect(file.monster.reactions).toEqual([])
  })

  it('imports an array of monsters', () => {
    const files = importPayload([knight, kaukas])
    expect(files).toHaveLength(2)
  })
})
