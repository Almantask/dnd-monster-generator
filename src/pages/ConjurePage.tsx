import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileJson, Flame, LoaderCircle } from 'lucide-react'
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
        className="panel mx-auto max-w-2xl space-y-5 p-6"
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
        <div>
          <h2 className="section-heading flex items-center gap-2 text-2xl">
            <Flame className="text-oxblood/70 size-5" aria-hidden="true" />
            Conjure a monster
          </h2>
          <hr className="stat-rule mt-2 mb-3" />
          <p className="text-ink/70 italic">
            Name the creature, set the party it should threaten, and describe its look, weapons, and
            ways.
          </p>
          <p className="mt-2 text-sm">
            <span className="text-ink/60">Have JSON already? </span>
            <Link to="/scribe?mode=json" className="link-quill inline-flex items-center gap-1">
              <FileJson className="size-3.5" aria-hidden="true" />
              Paste JSON statblock
            </Link>
          </p>
        </div>

        <label className="block">
          <span className="field-label mb-1">Name</span>
          <input
            required
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ashfang, the Cinder Drake"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="field-label mb-1">Party size</span>
            <select
              className="field"
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
          <label className="block">
            <span className="field-label mb-1">Character level</span>
            <select
              className="field"
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
          <label className="block">
            <span className="field-label mb-1">Difficulty</span>
            <select
              className="field"
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
          <span className="field-label mb-1">Description</span>
          <textarea
            required
            rows={8}
            className="field"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Visuals, abilities, traits, weapons, alignment, tactics, drops…"
          />
        </label>

        {error ? (
          <p
            role="alert"
            className="anim-pop border-oxblood/50 bg-oxblood/10 text-oxblood-dark rounded border p-3 text-sm"
          >
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={busy !== 'idle'} className="btn btn-primary w-full sm:w-auto">
          {busy === 'idle' ? (
            <Flame className="size-4" aria-hidden="true" />
          ) : (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          )}
          {busy === 'stats'
            ? 'Inscribing the statblock…'
            : busy === 'art'
              ? 'Summoning the likeness…'
              : 'Conjure'}
        </button>
      </form>
    </>
  )
}
