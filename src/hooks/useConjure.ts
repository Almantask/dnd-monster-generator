import { createContext, useContext, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import type { Difficulty } from '@shared/taxonomies.ts'

export type ConjureBusy = 'idle' | 'stats' | 'art'

export type ConjureContextValue = {
  name: string
  setName: Dispatch<SetStateAction<string>>
  partySize: number
  setPartySize: Dispatch<SetStateAction<number>>
  characterLevel: number
  setCharacterLevel: Dispatch<SetStateAction<number>>
  difficulty: Difficulty
  setDifficulty: Dispatch<SetStateAction<Difficulty>>
  description: string
  setDescription: Dispatch<SetStateAction<string>>
  busy: ConjureBusy
  error: string
  activeName: string
  startedAt: number | null
  startConjure: (event?: FormEvent) => void
}

export const ConjureContext = createContext<ConjureContextValue | null>(null)

export function useConjure() {
  const ctx = useContext(ConjureContext)
  if (!ctx) throw new Error('useConjure must be used within ConjureProvider')
  return ctx
}
