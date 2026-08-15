import JSZip from 'jszip'
import type { Monster } from '@shared/monsterSchema.ts'
import { exportWrapperSchema } from '@shared/monsterSchema.ts'
import { importPayload } from '@shared/importAdapter.ts'
import { db, getImageRecord, saveImage, saveMonster, type ImageRecord } from './storage.ts'

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function monsterToWrapper(monster: Monster) {
  const image = await getImageRecord(monster.imageBlobId)
  return {
    schemaVersion: 1 as const,
    monster,
    image: image
      ? { mime: image.mime, dataUrl: await blobToDataUrl(image.blob) }
      : null,
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportMonsters(monsters: Monster[], asZip: boolean) {
  if (monsters.length === 1 && !asZip) {
    const wrapper = await monsterToWrapper(monsters[0]!)
    const blob = new Blob([JSON.stringify(wrapper, null, 2)], {
      type: 'application/json',
    })
    downloadBlob(blob, `${slug(monsters[0]!.name)}.json`)
    return
  }
  const zip = new JSZip()
  for (const monster of monsters) {
    const wrapper = await monsterToWrapper(monster)
    zip.file(`${slug(monster.name)}.json`, JSON.stringify(wrapper, null, 2))
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, 'bestiary-export.zip')
}

export async function importFiles(files: File[]): Promise<number> {
  let count = 0
  for (const file of files) {
    if (file.name.endsWith('.zip')) {
      const zip = await JSZip.loadAsync(file)
      for (const name of Object.keys(zip.files)) {
        if (!name.endsWith('.json') || zip.files[name]?.dir) continue
        const text = await zip.files[name]!.async('string')
        count += await importJsonText(text)
      }
      continue
    }
    count += await importJsonText(await file.text())
  }
  return count
}

async function importJsonText(text: string): Promise<number> {
  const parsed: unknown = JSON.parse(text)
  const items = importPayload(parsed)
  for (const item of items) {
    let imageBlobId = item.monster.imageBlobId
    if (item.image?.dataUrl) {
      imageBlobId = await saveImageFromDataUrl(item.image.dataUrl, item.image.mime)
    }
    await saveMonster({ ...item.monster, imageBlobId })
  }
  return items.length
}

export async function saveImageFromDataUrl(dataUrl: string, mime: string): Promise<string> {
  const [header, data] = dataUrl.split(',')
  const resolvedMime = mime || /data:(.*?);/.exec(header)?.[1] || 'image/png'
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
  return saveImage(new Blob([bytes], { type: resolvedMime }), resolvedMime)
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'monster'
}

export { db, exportWrapperSchema }
export type { ImageRecord }
