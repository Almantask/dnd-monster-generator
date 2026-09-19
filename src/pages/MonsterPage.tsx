import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileDown, FileText, ImageDown, ImagePlus, LoaderCircle, Pencil, Trash2 } from 'lucide-react'
import { Statblock } from '@/components/statblock/Statblock.tsx'
import { deleteMonster, getImageUrl, getMonster } from '@/lib/storage.ts'
import { exportMonsters } from '@/lib/importExport.ts'
import { exportStatblockPdf, exportStatblockPng } from '@/lib/exportSheet.ts'
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
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null)
  const sheetRef = useRef<HTMLElement>(null)

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

  async function exportSheet(format: 'png' | 'pdf') {
    const entry = monster
    const node = sheetRef.current
    if (!entry || !node) {
      setError('The statblock is not ready to export.')
      return
    }
    setExporting(format)
    setError('')
    try {
      if (format === 'png') await exportStatblockPng(node, entry.name)
      else await exportStatblockPdf(node, entry.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(null)
    }
  }

  if (error && !monster) {
    return (
      <div className="panel-dashed mx-auto max-w-lg p-8 text-center">
        <p className="font-display text-oxblood text-lg">{error}</p>
        <Link className="btn btn-outline btn-sm mt-4" to="/">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Return to the Bestiary
        </Link>
      </div>
    )
  }
  if (!monster) {
    return (
      <p role="status" className="text-oxblood/80 flex items-center justify-center gap-2 py-16 italic">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        Opening the tome…
      </p>
    )
  }

  return (
    <div>
      {busy && <ConjureProgressModal busy="art" name={monster.name} />}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link className="btn btn-ghost btn-sm" to="/">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to Bestiary
        </Link>
        <span className="flex-1" />
        <Link className="btn btn-outline btn-sm" to={`/scribe/${monster.id}`}>
          <Pencil className="size-3.5" aria-hidden="true" />
          Edit
        </Link>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => void exportMonsters([monster], false)}
        >
          <FileDown className="size-3.5" aria-hidden="true" />
          Export JSON
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={exporting !== null}
          onClick={() => void exportSheet('png')}
        >
          {exporting === 'png' ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <ImageDown className="size-3.5" aria-hidden="true" />
          )}
          {exporting === 'png' ? 'Exporting PNG…' : 'Export PNG'}
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={exporting !== null}
          onClick={() => void exportSheet('pdf')}
        >
          {exporting === 'pdf' ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <FileText className="size-3.5" aria-hidden="true" />
          )}
          {exporting === 'pdf' ? 'Exporting PDF…' : 'Export PDF'}
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
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
          {busy ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <ImagePlus className="size-3.5" aria-hidden="true" />
          )}
          {busy ? 'Summoning art…' : 'Retry art'}
        </button>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={async () => {
            await deleteMonster(monster.id)
            navigate('/')
          }}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          Delete
        </button>
      </div>
      {error ? (
        <p
          role="alert"
          className="anim-pop border-oxblood/50 bg-oxblood/10 text-oxblood-dark mb-4 rounded border p-3 text-sm"
        >
          {error}
        </p>
      ) : null}
      <Statblock ref={sheetRef} monster={monster} imageUrl={imageUrl} />
    </div>
  )
}
