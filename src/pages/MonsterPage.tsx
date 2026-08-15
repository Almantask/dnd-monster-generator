import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Statblock } from '@/components/statblock/Statblock.tsx'
import { deleteMonster, getImageUrl, getMonster } from '@/lib/storage.ts'
import { exportMonsters } from '@/lib/importExport.ts'
import { dataUrlToBlob, generateImage } from '@/lib/api.ts'
import { saveImage, saveMonster } from '@/lib/storage.ts'
import { ConjureProgressModal } from '@/components/common/ConjureProgressModal.tsx'
import type { Monster } from '@shared/monsterSchema.ts'

export function MonsterPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [monster, setMonster] = useState<Monster | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let revoked: string | null = null
    async function load() {
      if (!id) return
      const row = await getMonster(id)
      if (!row) {
        setError('This entry is missing from the tome.')
        return
      }
      setMonster(row)
      const url = await getImageUrl(row.imageBlobId)
      revoked = url
      setImageUrl(url)
    }
    void load()
    return () => {
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [id])

  if (error) {
    return (
      <p>
        {error} <Link to="/">Return to the Bestiary</Link>
      </p>
    )
  }
  if (!monster) return <p role="status">Opening the tome…</p>

  return (
    <div>
      {busy && <ConjureProgressModal busy="art" name={monster.name} />}
      <div className="mb-4 flex flex-wrap gap-3">
        <Link className="underline" to="/">
          Back to Bestiary
        </Link>
        <Link className="underline" to={`/scribe/${monster.id}`}>
          Edit
        </Link>
        <button
          type="button"
          className="underline"
          onClick={() => void exportMonsters([monster], false)}
        >
          Export JSON
        </button>
        <button
          type="button"
          className="underline"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setError('')
            try {
              const image = await generateImage({
                name: monster.name,
                description: monster.lore || monster.tactics || monster.type,
                type: monster.type,
                size: monster.size,
              })
              const blob = dataUrlToBlob(image.dataUrl)
              const imageBlobId = await saveImage(blob, image.mime)
              const next = { ...monster, imageBlobId, updatedAt: new Date().toISOString() }
              await saveMonster(next)
              setMonster(next)
              if (imageUrl) URL.revokeObjectURL(imageUrl)
              setImageUrl(URL.createObjectURL(blob))
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Art failed')
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Summoning art…' : 'Retry art'}
        </button>
        <button
          type="button"
          className="text-oxblood underline"
          onClick={async () => {
            await deleteMonster(monster.id)
            navigate('/')
          }}
        >
          Delete
        </button>
      </div>
      {error ? <p className="mb-3 text-oxblood">{error}</p> : null}
      <Statblock monster={monster} imageUrl={imageUrl} />
    </div>
  )
}
