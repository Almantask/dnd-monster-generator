import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Monster } from '@shared/monsterSchema.ts'
import {
  ARCHETYPES,
  GROUPS,
  HABITATS,
  LOCOMOTIONS,
  PERSONALITIES,
  SIZES,
} from '@shared/taxonomies.ts'
import { deleteMonster, getImageUrl, listMonsters } from '@/lib/storage.ts'
import { exportMonsters, importFiles } from '@/lib/importExport.ts'

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly string[]
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-display uppercase tracking-wide text-oxblood">
      {label}
      <select
        className="rounded border border-oxblood/40 bg-statblock px-2 py-1 font-body text-sm text-ink"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

export function BestiaryPage() {
  const [monsters, setMonsters] = useState<Monster[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({
    habitat: '',
    archetype: '',
    alignment: '',
    cr: '',
    locomotion: '',
    group: '',
    personality: '',
    size: '',
  })
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')

  async function refresh() {
    const rows = await listMonsters()
    setMonsters(rows)
    const next: Record<string, string> = {}
    for (const monster of rows) {
      const url = await getImageUrl(monster.imageBlobId)
      if (url) next[monster.id] = url
    }
    setThumbs(next)
  }

  useEffect(() => {
    void refresh()
  }, [])

  const alignments = useMemo(
    () => [...new Set(monsters.map((m) => m.alignment))].sort(),
    [monsters],
  )
  const crs = useMemo(
    () => [...new Set(monsters.map((m) => m.cr))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [monsters],
  )

  const visible = monsters.filter((monster) => {
    const q = query.trim().toLowerCase()
    if (q && !monster.name.toLowerCase().includes(q) && !monster.type.toLowerCase().includes(q)) {
      return false
    }
    if (filters.habitat && monster.habitat !== filters.habitat) return false
    if (filters.archetype && monster.archetype !== filters.archetype) return false
    if (filters.alignment && monster.alignment !== filters.alignment) return false
    if (filters.cr && monster.cr !== filters.cr) return false
    if (filters.locomotion && !monster.locomotion.includes(filters.locomotion as Monster['locomotion'][number])) {
      return false
    }
    if (filters.group && monster.group !== filters.group) return false
    if (filters.personality && monster.personality !== filters.personality) return false
    if (filters.size && monster.size !== filters.size) return false
    return true
  })

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const chosen = monsters.filter((m) => selected.has(m.id))

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-display uppercase tracking-wide text-oxblood">
          Search
          <input
            className="rounded border border-oxblood/40 bg-statblock px-2 py-1 font-body text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or type"
          />
        </label>
        <FilterSelect label="Habitat" value={filters.habitat} options={HABITATS} onChange={(habitat) => setFilters((f) => ({ ...f, habitat }))} />
        <FilterSelect label="Archetype" value={filters.archetype} options={ARCHETYPES} onChange={(archetype) => setFilters((f) => ({ ...f, archetype }))} />
        <FilterSelect label="Size" value={filters.size} options={SIZES} onChange={(size) => setFilters((f) => ({ ...f, size }))} />
        <FilterSelect label="Group" value={filters.group} options={GROUPS} onChange={(group) => setFilters((f) => ({ ...f, group }))} />
        <FilterSelect label="Personality" value={filters.personality} options={PERSONALITIES} onChange={(personality) => setFilters((f) => ({ ...f, personality }))} />
        <FilterSelect label="Locomotion" value={filters.locomotion} options={LOCOMOTIONS} onChange={(locomotion) => setFilters((f) => ({ ...f, locomotion }))} />
        <FilterSelect label="Alignment" value={filters.alignment} options={alignments} onChange={(alignment) => setFilters((f) => ({ ...f, alignment }))} />
        <FilterSelect label="CR" value={filters.cr} options={crs} onChange={(cr) => setFilters((f) => ({ ...f, cr }))} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded bg-oxblood px-3 py-1 font-display text-sm text-parchment"
          onClick={() => void exportMonsters(chosen.length ? chosen : visible, true)}
        >
          Export {chosen.length ? 'selected' : visible.length ? 'visible' : 'all'}
        </button>
        <button
          type="button"
          className="rounded border border-oxblood px-3 py-1 font-display text-sm text-oxblood"
          onClick={() => void exportMonsters(monsters, true)}
        >
          Export all
        </button>
        <label className="cursor-pointer rounded border border-oxblood px-3 py-1 font-display text-sm text-oxblood">
          Import JSON
          <input
            type="file"
            accept=".json,.zip,application/json"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])]
              if (!files.length) return
              const count = await importFiles(files)
              setMessage(`Imported ${count} entr${count === 1 ? 'y' : 'ies'}.`)
              await refresh()
              e.target.value = ''
            }}
          />
        </label>
        <label className="cursor-pointer rounded border border-oxblood px-3 py-1 font-display text-sm text-oxblood">
          Import folder
          <input
            type="file"
            multiple
            className="hidden"
            // @ts-expect-error webkitdirectory is non-standard
            webkitdirectory=""
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])].filter((f) => f.name.endsWith('.json') || f.name.endsWith('.zip'))
              const count = await importFiles(files)
              setMessage(`Imported ${count} entr${count === 1 ? 'y' : 'ies'}.`)
              await refresh()
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {message ? <p className="mb-3 text-sm italic">{message}</p> : null}

      {visible.length === 0 ? (
        <div className="rounded border border-dashed border-oxblood/50 bg-statblock/70 p-10 text-center">
          <p className="font-display text-xl text-oxblood">The tome is empty.</p>
          <p className="mt-2">
            <Link className="underline" to="/conjure">
              Conjure a beast
            </Link>{' '}
            or{' '}
            <Link className="underline" to="/scribe">
              scribe one by hand
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((monster) => (
            <li key={monster.id} className="overflow-hidden rounded border border-oxblood/40 bg-statblock shadow">
              <label className="flex items-center gap-2 px-3 pt-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(monster.id)}
                  onChange={() => toggle(monster.id)}
                />
                Select
              </label>
              <Link to={`/monster/${monster.id}`} className="block">
                <div className="aspect-[3/4] bg-black/5">
                  {thumbs[monster.id] ? (
                    <img src={thumbs[monster.id]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center italic text-ink/40">No art</div>
                  )}
                </div>
                <div className="p-3">
                  <h2 className="font-display text-lg font-bold text-oxblood uppercase">{monster.name}</h2>
                  <p className="text-sm italic">
                    {monster.size} {monster.type} · CR {monster.cr}
                  </p>
                  <p className="text-xs text-ink/70">
                    {monster.habitat} · {monster.archetype} · {monster.group}
                  </p>
                </div>
              </Link>
              <div className="flex gap-2 px-3 pb-3">
                <Link className="text-sm underline" to={`/scribe/${monster.id}`}>
                  Edit
                </Link>
                <button
                  type="button"
                  className="text-sm text-oxblood underline"
                  onClick={async () => {
                    await deleteMonster(monster.id)
                    setSelected((current) => {
                      const next = new Set(current)
                      next.delete(monster.id)
                      return next
                    })
                    await refresh()
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
