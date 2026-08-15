import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DIFFICULTIES, type Difficulty } from '@shared/taxonomies.ts'
import { withIdentity } from '@shared/importAdapter.ts'
import { dataUrlToBlob, generateImage, generateStatblock } from '@/lib/api.ts'
import { saveImage, saveMonster } from '@/lib/storage.ts'
import { ConjureProgressModal } from '@/components/common/ConjureProgressModal.tsx'

export function ConjurePage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [partySize, setPartySize] = useState(4)
  const [characterLevel, setCharacterLevel] = useState(5)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState<'idle' | 'stats' | 'art'>('idle')
  const [error, setError] = useState('')

  return (
    <>
      {busy !== 'idle' && <ConjureProgressModal busy={busy} name={name.trim()} />}
      <form
        className="mx-auto max-w-2xl space-y-4 rounded border border-oxblood/40 bg-statblock p-6"
        onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          setBusy('stats')
          try {
            const generated = await generateStatblock({
              name: name.trim(),
              partySize,
              characterLevel,
              difficulty,
              description: description.trim(),
            })
            let monster = withIdentity(generated, 'ai')
            setBusy('art')
            try {
              const image = await generateImage({
                name: monster.name,
                description: description.trim() || monster.lore,
                type: monster.type,
                size: monster.size,
              })
              const imageBlobId = await saveImage(dataUrlToBlob(image.dataUrl), image.mime)
              monster = { ...monster, imageBlobId }
            } catch {
              // Art is optional; the entry still saves.
            }
            await saveMonster(monster)
            navigate(`/monster/${monster.id}`)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Conjuration failed')
          } finally {
            setBusy('idle')
          }
        }}
      >
        <h2 className="font-display text-2xl text-oxblood uppercase">Conjure a monster</h2>
        <p className="italic text-ink/70">
          Name the creature, set the party it should threaten, and describe its look, weapons, and ways. (Have JSON already?{' '}
          <Link to="/scribe?mode=json" className="text-oxblood underline hover:text-oxblood-dark">
            Paste JSON statblock
          </Link>
          )
        </p>
        <label className="block">
          <span className="font-display text-sm uppercase text-oxblood">Name</span>
          <input
            required
            className="mt-1 w-full rounded border border-oxblood/40 bg-parchment px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className="font-display text-sm uppercase text-oxblood">Party size</span>
            <select
              className="mt-1 w-full rounded border border-oxblood/40 bg-parchment px-3 py-2"
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value))}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="font-display text-sm uppercase text-oxblood">Character level</span>
            <select
              className="mt-1 w-full rounded border border-oxblood/40 bg-parchment px-3 py-2"
              value={characterLevel}
              onChange={(e) => setCharacterLevel(Number(e.target.value))}
            >
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="font-display text-sm uppercase text-oxblood">Difficulty</span>
            <select
              className="mt-1 w-full rounded border border-oxblood/40 bg-parchment px-3 py-2"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="font-display text-sm uppercase text-oxblood">Description</span>
          <textarea
            required
            rows={8}
            className="mt-1 w-full rounded border border-oxblood/40 bg-parchment px-3 py-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Visuals, abilities, traits, weapons, alignment, tactics, drops…"
          />
        </label>
        {error ? (
          <p role="alert" className="text-oxblood">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy !== 'idle'}
          className="rounded bg-oxblood px-4 py-2 font-display tracking-wide text-parchment uppercase disabled:opacity-60"
        >
          {busy === 'stats' ? 'Inscribing the statblock…' : busy === 'art' ? 'Summoning the likeness…' : 'Conjure'}
        </button>
      </form>
    </>
  )
}
