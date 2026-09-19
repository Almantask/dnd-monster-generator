import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ClipboardList, PenLine, Plus, Save, X } from 'lucide-react'
import type { Monster, NamedFeature } from '@shared/monsterSchema.ts'
import {
  ARCHETYPES,
  GROUPS,
  HABITATS,
  LOCOMOTIONS,
  PERSONALITIES,
  SIZES,
  type Locomotion,
} from '@shared/taxonomies.ts'
import { createBlankMonster } from '@shared/importAdapter.ts'
import { getImageUrl, getMonster, saveImage, saveMonster } from '@/lib/storage.ts'
import { PasteJsonEditor } from '@/components/statblock/PasteJsonEditor.tsx'

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

const inputClass = 'field'

function FeatureEditor({
  title,
  items,
  onChange,
}: {
  title: string
  items: NamedFeature[]
  onChange: (items: NamedFeature[]) => void
}) {
  return (
    <fieldset className="panel-inset space-y-2 p-3">
      <legend className="section-heading px-1 text-sm">{title}</legend>
      {items.map((item, index) => (
        <div key={index} className="anim-fade grid gap-2 md:grid-cols-[12rem_1fr_auto]">
          <input
            className={inputClass}
            value={item.name}
            placeholder="Name"
            onChange={(e) => {
              const next = [...items]
              next[index] = { ...item, name: e.target.value }
              onChange(next)
            }}
          />
          <textarea
            className={inputClass}
            rows={2}
            value={item.desc}
            placeholder="Description"
            onChange={(e) => {
              const next = [...items]
              next[index] = { ...item, desc: e.target.value }
              onChange(next)
            }}
          />
          <button
            type="button"
            className="btn btn-danger btn-sm self-start"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            <X className="size-3.5" aria-hidden="true" />
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => onChange([...items, { name: '', desc: '' }])}
      >
        <Plus className="size-3.5" aria-hidden="true" />
        Add
      </button>
    </fieldset>
  )
}

export function ScribePage() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = searchParams.get('mode') === 'json' ? 'json' : 'form'
  const navigate = useNavigate()
  const [monster, setMonster] = useState<Monster>(() => createBlankMonster())
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let url: string | null = null
    async function load() {
      if (!id) return
      const row = await getMonster(id)
      if (!row) {
        setError('Entry not found')
        return
      }
      setMonster(row)
      url = await getImageUrl(row.imageBlobId)
      setPreview(url)
    }
    void load()
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [id])

  function update<K extends keyof Monster>(key: K, value: Monster[K]) {
    setMonster((current) => ({ ...current, [key]: value }))
  }

  const modeSwitcher = !id ? (
    <div className="mb-6 flex justify-center">
      <div className="nav-bar font-display flex gap-1 p-1 text-sm tracking-wider uppercase">
        <button
          type="button"
          aria-pressed={mode === 'form'}
          onClick={() => setSearchParams({ mode: 'form' })}
          className={`nav-link flex items-center gap-1.5 ${mode === 'form' ? 'nav-link-active' : ''}`}
        >
          <PenLine className="size-3.5" aria-hidden="true" />
          Manual Form
        </button>
        <button
          type="button"
          aria-pressed={mode === 'json'}
          onClick={() => setSearchParams({ mode: 'json' })}
          className={`nav-link flex items-center gap-1.5 ${mode === 'json' ? 'nav-link-active' : ''}`}
        >
          <ClipboardList className="size-3.5" aria-hidden="true" />
          Paste JSON
        </button>
      </div>
    </div>
  ) : null

  if (!id && mode === 'json') {
    return (
      <div className="space-y-4">
        {modeSwitcher}
        <div className="anim-rise">
          <PasteJsonEditor />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {modeSwitcher}
      <form
        className="panel anim-rise space-y-4 p-6"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!monster.name.trim()) {
            setError('Name is required')
            return
          }
          const next = { ...monster, name: monster.name.trim(), updatedAt: new Date().toISOString() }
          await saveMonster(next)
          navigate(`/monster/${next.id}`)
        }}
      >
        <div>
          <h2 className="section-heading text-2xl">{id ? 'Amend the entry' : 'Scribe a monster'}</h2>
          <hr className="stat-rule mt-2" />
        </div>
        {error ? (
          <p
            role="alert"
            className="anim-pop border-oxblood/50 bg-oxblood/10 text-oxblood-dark rounded border p-3 text-sm"
          >
            {error}
          </p>
        ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Name">
          <input className={inputClass} value={monster.name} onChange={(e) => update('name', e.target.value)} />
        </Field>
        <Field label="Type">
          <input className={inputClass} value={monster.type} onChange={(e) => update('type', e.target.value)} />
        </Field>
        <Field label="Subtype">
          <input
            className={inputClass}
            value={monster.subtype ?? ''}
            onChange={(e) => update('subtype', e.target.value || null)}
          />
        </Field>
        <Field label="Alignment">
          <input className={inputClass} value={monster.alignment} onChange={(e) => update('alignment', e.target.value)} />
        </Field>
        <Field label="Size">
          <select className={inputClass} value={monster.size} onChange={(e) => update('size', e.target.value as Monster['size'])}>
            {SIZES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Challenge">
          <input className={inputClass} value={monster.cr} onChange={(e) => update('cr', e.target.value)} />
        </Field>
        <Field label="Armor Class">
          <input className={inputClass} value={String(monster.ac)} onChange={(e) => update('ac', e.target.value)} />
        </Field>
        <Field label="Hit Points">
          <input
            type="number"
            className={inputClass}
            value={monster.hp}
            onChange={(e) => update('hp', Number(e.target.value))}
          />
        </Field>
        <Field label="Hit Dice">
          <input className={inputClass} value={monster.hit_dice} onChange={(e) => update('hit_dice', e.target.value)} />
        </Field>
        <Field label="Speed">
          <input className={inputClass} value={monster.speed} onChange={(e) => update('speed', e.target.value)} />
        </Field>
      </div>
      <fieldset>
        <legend className="section-heading text-sm">Ability scores</legend>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map((label, index) => (
            <Field key={label} label={label}>
              <input
                type="number"
                className={inputClass}
                value={monster.stats[index]}
                onChange={(e) => {
                  const stats = [...monster.stats] as Monster['stats']
                  stats[index] = Number(e.target.value)
                  update('stats', stats)
                }}
              />
            </Field>
          ))}
        </div>
      </fieldset>
      <Field label="Senses">
        <input className={inputClass} value={monster.senses} onChange={(e) => update('senses', e.target.value)} />
      </Field>
      <Field label="Languages">
        <input className={inputClass} value={monster.languages} onChange={(e) => update('languages', e.target.value)} />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Damage Vulnerabilities">
          <input className={inputClass} value={monster.damage_vulnerabilities ?? ''} onChange={(e) => update('damage_vulnerabilities', e.target.value || null)} />
        </Field>
        <Field label="Damage Resistances">
          <input className={inputClass} value={monster.damage_resistances ?? ''} onChange={(e) => update('damage_resistances', e.target.value || null)} />
        </Field>
        <Field label="Damage Immunities">
          <input className={inputClass} value={monster.damage_immunities ?? ''} onChange={(e) => update('damage_immunities', e.target.value || null)} />
        </Field>
        <Field label="Condition Immunities">
          <input className={inputClass} value={monster.condition_immunities ?? ''} onChange={(e) => update('condition_immunities', e.target.value || null)} />
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Habitat">
          <select className={inputClass} value={monster.habitat} onChange={(e) => update('habitat', e.target.value as Monster['habitat'])}>
            {HABITATS.map((h) => <option key={h}>{h}</option>)}
          </select>
        </Field>
        <Field label="Archetype">
          <select className={inputClass} value={monster.archetype} onChange={(e) => update('archetype', e.target.value as Monster['archetype'])}>
            {ARCHETYPES.map((h) => <option key={h}>{h}</option>)}
          </select>
        </Field>
        <Field label="Group">
          <select className={inputClass} value={monster.group} onChange={(e) => update('group', e.target.value as Monster['group'])}>
            {GROUPS.map((h) => <option key={h}>{h}</option>)}
          </select>
        </Field>
        <Field label="Personality">
          <select className={inputClass} value={monster.personality} onChange={(e) => update('personality', e.target.value as Monster['personality'])}>
            {PERSONALITIES.map((h) => <option key={h}>{h}</option>)}
          </select>
        </Field>
      </div>
      <fieldset>
        <legend className="section-heading text-sm">Locomotion</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {LOCOMOTIONS.map((loc) => (
            <label key={loc} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="check"
                checked={monster.locomotion.includes(loc)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...monster.locomotion, loc]
                    : monster.locomotion.filter((item) => item !== loc)
                  update('locomotion', (next.length ? next : ['Terrestrial']) as Locomotion[])
                }}
              />
              {loc}
            </label>
          ))}
        </div>
      </fieldset>
      <FeatureEditor title="Traits" items={monster.traits} onChange={(traits) => update('traits', traits)} />
      <FeatureEditor title="Actions" items={monster.actions} onChange={(actions) => update('actions', actions)} />
      <FeatureEditor title="Reactions" items={monster.reactions} onChange={(reactions) => update('reactions', reactions)} />
      <FeatureEditor title="Legendary Actions" items={monster.legendary_actions} onChange={(legendary_actions) => update('legendary_actions', legendary_actions)} />
      <FeatureEditor title="Spells" items={monster.spells} onChange={(spells) => update('spells', spells)} />
      <Field label="Lore">
        <textarea className={inputClass} rows={4} value={monster.lore} onChange={(e) => update('lore', e.target.value)} />
      </Field>
      <Field label="Tactics">
        <textarea className={inputClass} rows={3} value={monster.tactics} onChange={(e) => update('tactics', e.target.value)} />
      </Field>
      <Field label="Drops">
        <textarea className={inputClass} rows={2} value={monster.drops} onChange={(e) => update('drops', e.target.value)} />
      </Field>
      <Field label="Illustration">
        <input
          type="file"
          accept="image/*"
          className="file-quill text-ink/70 text-sm"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const imageBlobId = await saveImage(file, file.type)
            update('imageBlobId', imageBlobId)
            if (preview) URL.revokeObjectURL(preview)
            setPreview(URL.createObjectURL(file))
          }}
        />
        {preview ? (
          <img
            src={preview}
            alt=""
            className="anim-pop border-oxblood/30 mt-3 max-h-64 rounded-md border shadow-md"
          />
        ) : null}
      </Field>
      <button type="submit" className="btn btn-primary">
        <Save className="size-4" aria-hidden="true" />
        Save to the Bestiary
      </button>
    </form>
    </div>
  )
}

