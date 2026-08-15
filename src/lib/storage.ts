import Dexie, { type EntityTable } from 'dexie'
import type { Monster } from '@shared/monsterSchema.ts'

export type ImageRecord = {
  id: string
  blob: Blob
  mime: string
}

const db = new Dexie('bestiary') as Dexie & {
  monsters: EntityTable<Monster, 'id'>
  images: EntityTable<ImageRecord, 'id'>
}

db.version(1).stores({
  monsters: 'id, name, cr, habitat, archetype, group, size, source, alignment',
  images: 'id',
})

export { db }

export async function listMonsters(): Promise<Monster[]> {
  const rows = await db.monsters.toArray()
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

export async function getMonster(id: string): Promise<Monster | undefined> {
  return db.monsters.get(id)
}

export async function saveMonster(monster: Monster): Promise<void> {
  await db.monsters.put(monster)
}

export async function deleteMonster(id: string): Promise<void> {
  const monster = await db.monsters.get(id)
  await db.monsters.delete(id)
  if (monster?.imageBlobId) await db.images.delete(monster.imageBlobId)
}

export async function saveImage(blob: Blob, mime = blob.type || 'image/png'): Promise<string> {
  const id = crypto.randomUUID()
  await db.images.put({ id, blob, mime })
  return id
}

export async function getImageUrl(id: string | null): Promise<string | null> {
  if (!id) return null
  const record = await db.images.get(id)
  if (!record) return null
  return URL.createObjectURL(record.blob)
}

export async function getImageRecord(id: string | null): Promise<ImageRecord | undefined> {
  if (!id) return undefined
  return db.images.get(id)
}
