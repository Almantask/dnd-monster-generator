import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Download,
  FolderUp,
  ImageOff,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
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
    <label className="flex flex-col gap-1">
      <span className="field-label">{label}</span>
      <select className="field text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
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

const EMPTY_FILTERS = {
  habitat: '',
  archetype: '',
  alignment: '',
  cr: '',
  locomotion: '',
  group: '',
  personality: '',
  size: '',
}

export function BestiaryPage() {
  const [monsters, setMonsters] = useState<Monster[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  // Mirrors `thumbs` so we can revoke the previous batch of object URLs and
  // keep long browsing sessions from leaking blob memory.
  const thumbsRef = useRef<Record<string, string>>({})

  async function refresh() {
    const rows = await listMonsters()
    setMonsters(rows)
    // Resolve every thumbnail in parallel instead of awaiting them one by one.
    const entries = await Promise.all(
      rows.map(async (monster) => [monster.id, await getImageUrl(monster.imageBlobId)] as const),
    )
    const next: Record<string, string> = {}
    for (const [id, url] of entries) {
      if (url) next[id] = url
    }
    for (const url of Object.values(thumbsRef.current)) URL.revokeObjectURL(url)
    thumbsRef.current = next
    setThumbs(next)
  }

  useEffect(() => {
    void refresh()
    return () => {
      for (const url of Object.values(thumbsRef.current)) URL.revokeObjectURL(url)
      thumbsRef.current = {}
    }
  }, [])

  const alignments = useMemo(
    () => [...new Set(monsters.map((m) => m.alignment))].sort(),
    [monsters],
  )
  const crs = useMemo(
    () =>
      [...new Set(monsters.map((m) => m.cr))].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
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
    if (
      filters.locomotion &&
      !monster.locomotion.includes(filters.locomotion as Monster['locomotion'][number])
    ) {
      return false
    }
    if (filters.group && monster.group !== filters.group) return false
    if (filters.personality && monster.personality !== filters.personality) return false
    if (filters.size && monster.size !== filters.size) return false
    return true
  })

  const filtersActive = query.trim() !== '' || Object.values(filters).some(Boolean)

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
    <div className="space-y-5">
      <section className="panel p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="relative min-w-56 flex-1">
            <Search
              className="text-oxblood/55 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              className="field pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or type…"
              aria-label="Search the bestiary"
            />
          </label>
          <p className="font-display text-oxblood/75 text-xs tracking-widest uppercase">
            {visible.length} of {monsters.length} {monsters.length === 1 ? 'entry' : 'entries'}
            {chosen.length ? ` · ${chosen.length} selected` : ''}
          </p>
          {filtersActive ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setQuery('')
                setFilters(EMPTY_FILTERS)
              }}
            >
              <X className="size-3.5" aria-hidden="true" />
              Clear filters
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <FilterSelect
            label="Habitat"
            value={filters.habitat}
            options={HABITATS}
            onChange={(habitat) => setFilters((f) => ({ ...f, habitat }))}
          />
          <FilterSelect
            label="Archetype"
            value={filters.archetype}
            options={ARCHETYPES}
            onChange={(archetype) => setFilters((f) => ({ ...f, archetype }))}
          />
          <FilterSelect
            label="Size"
            value={filters.size}
            options={SIZES}
            onChange={(size) => setFilters((f) => ({ ...f, size }))}
          />
          <FilterSelect
            label="Group"
            value={filters.group}
            options={GROUPS}
            onChange={(group) => setFilters((f) => ({ ...f, group }))}
          />
          <FilterSelect
            label="Personality"
            value={filters.personality}
            options={PERSONALITIES}
            onChange={(personality) => setFilters((f) => ({ ...f, personality }))}
          />
          <FilterSelect
            label="Locomotion"
            value={filters.locomotion}
            options={LOCOMOTIONS}
            onChange={(locomotion) => setFilters((f) => ({ ...f, locomotion }))}
          />
          <FilterSelect
            label="Alignment"
            value={filters.alignment}
            options={alignments}
            onChange={(alignment) => setFilters((f) => ({ ...f, alignment }))}
          />
          <FilterSelect
            label="CR"
            value={filters.cr}
            options={crs}
            onChange={(cr) => setFilters((f) => ({ ...f, cr }))}
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => void exportMonsters(chosen.length ? chosen : visible, true)}
        >
          <Download className="size-3.5" aria-hidden="true" />
          Export {chosen.length ? 'selected' : visible.length ? 'visible' : 'all'}
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => void exportMonsters(monsters, true)}
        >
          <Download className="size-3.5" aria-hidden="true" />
          Export all
        </button>
        <label className="btn btn-outline btn-sm">
          <Upload className="size-3.5" aria-hidden="true" />
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
        <label className="btn btn-outline btn-sm">
          <FolderUp className="size-3.5" aria-hidden="true" />
          Import folder
          <input
            type="file"
            multiple
            className="hidden"
            // @ts-expect-error webkitdirectory is non-standard
            webkitdirectory=""
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])].filter(
                (f) => f.name.endsWith('.json') || f.name.endsWith('.zip'),
              )
              const count = await importFiles(files)
              setMessage(`Imported ${count} entr${count === 1 ? 'y' : 'ies'}.`)
              await refresh()
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {message ? (
        <p className="anim-fade text-oxblood-dark flex items-center gap-2 text-sm italic">
          <Sparkles className="size-4" aria-hidden="true" />
          {message}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div className="panel-dashed anim-pop p-12 text-center">
          <Sparkles className="text-oxblood/60 twinkle mx-auto mb-3 size-8" aria-hidden="true" />
          <p className="font-display text-oxblood text-xl">
            {monsters.length ? 'No beast matches that hunt.' : 'The tome is empty.'}
          </p>
          <p className="mt-2">
            <Link className="link-quill" to="/conjure">
              Conjure a beast
            </Link>
            {', '}
            <Link className="link-quill" to="/scribe?mode=json">
              paste JSON
            </Link>
            {', or '}
            <Link className="link-quill" to="/scribe">
              scribe one by hand
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((monster, index) => (
            <li
              key={monster.id}
              className={`card panel lift group overflow-hidden ${
                selected.has(monster.id) ? 'ring-gold ring-2' : ''
              }`}
            >
              <Link to={`/monster/${monster.id}`} className="block">
                <div className="card-art aspect-3/4">
                  {thumbs[monster.id] ? (
                    <img
                      src={thumbs[monster.id]}
                      alt=""
                      // The first row may be the page's LCP, so only defer the rest.
                      loading={index < 3 ? undefined : 'lazy'}
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-ink/35 flex h-full flex-col items-center justify-center gap-2 italic">
                      <ImageOff className="size-7" aria-hidden="true" />
                      No art
                    </div>
                  )}
                  <span className="font-display text-parchment bg-oxblood-dark/85 absolute top-2 left-2 z-1 rounded-full px-2 py-0.5 text-xs tracking-wider shadow-sm">
                    CR {monster.cr}
                  </span>
                </div>
                <div className="p-3">
                  <h2 className="font-display text-oxblood text-lg font-bold uppercase">
                    {monster.name}
                  </h2>
                  <p className="text-sm italic">
                    {monster.size} {monster.type}
                  </p>
                  <p className="text-ink/70 mt-1 text-xs">
                    {monster.habitat} · {monster.archetype} · {monster.group}
                  </p>
                </div>
              </Link>
              <div className="border-oxblood/15 flex items-center gap-2 border-t px-3 py-2 text-xs">
                <label className="text-ink/70 hover:text-ink flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="check"
                    checked={selected.has(monster.id)}
                    onChange={() => toggle(monster.id)}
                  />
                  Select
                </label>
                <span className="ml-auto flex items-center gap-1">
                  <Link
                    className="btn btn-ghost btn-sm"
                    to={`/scribe/${monster.id}`}
                    aria-label={`Edit ${monster.name}`}
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Edit
                  </Link>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    aria-label={`Delete ${monster.name}`}
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
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Delete
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
