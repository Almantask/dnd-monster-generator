import type { Difficulty } from '@shared/taxonomies.ts'
import type { GeneratedMonster } from '@shared/monsterSchema.ts'
import { generatedMonsterSchema } from '@shared/monsterSchema.ts'
import { apiBase } from './utils.ts'
import { getPassphrase } from './settings.ts'

async function request<T>(path: string, body: unknown): Promise<T> {
  const base = apiBase()
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(getPassphrase() ? { 'X-Bestiary-Key': getPassphrase() } : {}),
    },
    body: JSON.stringify(body),
  })
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      typeof data === 'object' && data && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`
    throw new Error(message)
  }
  return data as T
}

export async function generateStatblock(input: {
  name: string
  partySize: number
  characterLevel: number
  difficulty: Difficulty
  description: string
}): Promise<GeneratedMonster> {
  const data = await request<{ monster: unknown }>('/api/statblock', input)
  return generatedMonsterSchema.parse(data.monster)
}

export async function generateImage(input: {
  name: string
  description: string
  type: string
  size: string
}): Promise<{ mime: string; dataUrl: string }> {
  return request('/api/image', input)
}

export async function fetchStatus(): Promise<{
  gemini: boolean
  geminiQuotaExceeded?: boolean
  geminiQuotaResetInMs?: number
  openrouter: boolean
  pollinations: boolean
  huggingface: boolean
  passphraseRequired: boolean
}> {
  const base = apiBase()
  const res = await fetch(`${base}/api/status`)
  if (!res.ok) {
    return {
      gemini: false,
      geminiQuotaExceeded: false,
      geminiQuotaResetInMs: 0,
      openrouter: false,
      pollinations: false,
      huggingface: false,
      passphraseRequired: false,
    }
  }
  return res.json() as Promise<{
    gemini: boolean
    geminiQuotaExceeded?: boolean
    geminiQuotaResetInMs?: number
    openrouter: boolean
    pollinations: boolean
    huggingface: boolean
    passphraseRequired: boolean
  }>
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',')
  const mime = /data:(.*?);/.exec(header)?.[1] ?? 'image/png'
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: mime })
}
