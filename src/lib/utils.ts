import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function apiBase(): string {
  if (typeof localStorage !== 'undefined') {
    const override = localStorage.getItem('bestiary.apiUrl')
    if (override) return override.replace(/\/$/, '')
  }
  const env = import.meta.env.VITE_API_URL as string | undefined
  return (env ?? '').replace(/\/$/, '')
}

export function formatAc(ac: string | number): string {
  return String(ac)
}

export function typeLine(monster: {
  size: string
  type: string
  subtype: string | null
  alignment: string
}): string {
  const subtype = monster.subtype ? ` (${monster.subtype})` : ''
  return `${monster.size} ${monster.type}${subtype}, ${monster.alignment}`
}
