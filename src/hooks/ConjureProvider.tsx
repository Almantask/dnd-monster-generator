import { useCallback, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Difficulty } from '@shared/taxonomies.ts'
import { withIdentity } from '@shared/importAdapter.ts'
import { dataUrlToBlob, generateImage, generateStatblock } from '@/lib/api.ts'
import { saveImage, saveMonster } from '@/lib/storage.ts'
import {
  ConjureProgressBanner,
  ConjureProgressModal,
} from '@/components/common/ConjureProgressModal.tsx'
import { ConjureContext, type ConjureBusy } from './useConjure.ts'

export function ConjureProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const pathnameRef = useRef(location.pathname)
  pathnameRef.current = location.pathname
  const [name, setName] = useState('')
  const [partySize, setPartySize] = useState(4)
  const [characterLevel, setCharacterLevel] = useState(5)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState<ConjureBusy>('idle')
  const [error, setError] = useState('')
  const [activeName, setActiveName] = useState('')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const inFlight = useRef(false)

  const startConjure = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault()
      if (inFlight.current) return

      const input = {
        name: name.trim(),
        partySize,
        characterLevel,
        difficulty,
        description: description.trim(),
      }
      if (!input.name || !input.description) return

      inFlight.current = true
      setError('')
      setActiveName(input.name)
      setBusy('stats')
      setStartedAt(Date.now())

      void (async () => {
        try {
          const generated = await generateStatblock(input)
          let monster = withIdentity(generated, 'ai')
          setBusy('art')
          try {
            const image = await generateImage({
              name: monster.name,
              description: input.description || monster.lore,
              type: monster.type,
              size: monster.size,
            })
            const imageBlobId = await saveImage(dataUrlToBlob(image.dataUrl), image.mime)
            monster = { ...monster, imageBlobId }
          } catch {
            // Art is optional; the entry still saves.
          }
          await saveMonster(monster)
          setName('')
          setDescription('')
          navigate(`/monster/${monster.id}`)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Conjuration failed')
          if (pathnameRef.current !== '/conjure') navigate('/conjure')
        } finally {
          inFlight.current = false
          setBusy('idle')
          setStartedAt(null)
        }
      })()
    },
    [characterLevel, description, difficulty, name, navigate, partySize],
  )

  const value = useMemo(
    () => ({
      name,
      setName,
      partySize,
      setPartySize,
      characterLevel,
      setCharacterLevel,
      difficulty,
      setDifficulty,
      description,
      setDescription,
      busy,
      error,
      activeName,
      startedAt,
      startConjure,
    }),
    [
      activeName,
      busy,
      characterLevel,
      description,
      difficulty,
      error,
      name,
      partySize,
      startConjure,
      startedAt,
    ],
  )

  const onConjure = location.pathname === '/conjure'

  return (
    <ConjureContext.Provider value={value}>
      {children}
      {busy !== 'idle' && onConjure ? (
        <ConjureProgressModal busy={busy} name={activeName} startedAt={startedAt} />
      ) : null}
      {busy !== 'idle' && !onConjure ? (
        <ConjureProgressBanner busy={busy} name={activeName} startedAt={startedAt} />
      ) : null}
    </ConjureContext.Provider>
  )
}
