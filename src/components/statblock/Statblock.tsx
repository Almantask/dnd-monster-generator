import type { ReactNode, Ref } from 'react'
import { Gem, ImageOff, ScrollText, Swords, type LucideIcon } from 'lucide-react'
import { ABILITY_ABBREV } from '@shared/taxonomies.ts'
import { abilityModifier, formatModifier, parseDiceExpressions } from '@shared/dice.ts'
import type { Monster, NamedFeature } from '@shared/monsterSchema.ts'
import { typeLine, formatAc } from '@/lib/utils.ts'
import { DiceText } from '@/components/dice/DiceText.tsx'
import { DiceHotButton } from '@/components/dice/DiceHotButton.tsx'
import { DiceMarker } from '@/components/dice/DiceMarker.tsx'
import { rollFeature } from '@/lib/rollFeature.ts'
import { useDice } from '@/hooks/useDice.ts'

function Section({ title, children }: { title: string; children: ReactNode }) {
  if (!children) return null
  return (
    <section className="mt-4">
      <h3 className="section-heading flex items-center gap-2 text-lg">
        <span aria-hidden="true" className="text-gold text-xs">
          ◆
        </span>
        {title}
      </h3>
      <hr className="stat-rule mb-2" />
      {children}
    </section>
  )
}

function FeatureList({ items }: { items: NamedFeature[] }) {
  const dice = useDice()
  if (!items.length) return null
  return (
    <div className="mt-2 space-y-2">
      {items.map((item) => (
        <p key={item.name}>
          <DiceHotButton
            className="mr-1 font-bold italic"
            onClick={() => rollFeature(`${item.name} ${item.desc}`, item.name, dice)}
          >
            {item.name}.
          </DiceHotButton>
          <DiceText text={item.desc} label={item.name} />
        </p>
      ))}
    </div>
  )
}

function Defense({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <p>
      <strong>{label}</strong> {value}
    </p>
  )
}

function LoreBlock({ title, Icon, text }: { title: string; Icon: LucideIcon; text: string }) {
  return (
    <section className="panel p-5">
      <h3 className="section-heading flex items-center gap-2 text-xl">
        <Icon className="text-oxblood/70 size-5" aria-hidden="true" />
        {title}
      </h3>
      <hr className="stat-rule mt-1 mb-3" />
      <p className="whitespace-pre-wrap">{text}</p>
    </section>
  )
}

export function Statblock({
  monster,
  imageUrl,
  ref,
}: {
  monster: Monster
  imageUrl?: string | null
  ref?: Ref<HTMLElement>
}) {
  const dice = useDice()
  const hitDice = parseDiceExpressions(monster.hit_dice)[0]

  return (
    <article ref={ref} className="statblock-sheet grid gap-6 lg:grid-cols-[minmax(0,300px)_1fr]">
      <div className="statblock-portrait anim-rise lg:sticky lg:top-20 lg:self-start">
        <div className="panel overflow-hidden p-1.5">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={monster.name}
              decoding="async"
              className="w-full rounded-md object-cover object-top"
            />
          ) : (
            <div className="text-ink/45 flex min-h-80 flex-col items-center justify-center gap-2 p-6 text-center italic">
              <ImageOff className="size-8" aria-hidden="true" />
              No illustration in this entry.
            </div>
          )}
        </div>
      </div>

      <div className="panel anim-rise delay-1 p-6">
        <h2 className="title-tome font-display text-3xl font-bold tracking-wide uppercase">
          {monster.name}
        </h2>
        <p className="text-ink/80 italic">{typeLine(monster)}</p>
        <hr className="stat-rule my-3" />
        <p>
          <strong>Armor Class</strong> {formatAc(monster.ac)}
        </p>
        <p>
          <strong>Hit Points</strong>{' '}
          {hitDice ? (
            <DiceHotButton onClick={() => dice.rollExpr(hitDice, 'Hit dice')}>
              {monster.hp} ({monster.hit_dice})
            </DiceHotButton>
          ) : (
            <>
              {monster.hp} ({monster.hit_dice})
            </>
          )}
        </p>
        <p>
          <strong>Speed</strong> {monster.speed}
        </p>
        <hr className="stat-rule-thin my-3" />
        <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
          {ABILITY_ABBREV.map((abbrev, index) => {
            const score = monster.stats[index] ?? 10
            const mod = abilityModifier(score)
            return (
              <button
                key={abbrev}
                type="button"
                className="ability-tile cursor-pointer py-1.5"
                onClick={() => dice.rollCheck(mod, abbrev)}
              >
                <div className="font-display text-oxblood flex items-center justify-center gap-0.5 text-xs font-bold">
                  {abbrev}
                  <DiceMarker />
                </div>
                <div className="text-sm">
                  {score} <span className="text-ink/65">({formatModifier(mod)})</span>
                </div>
              </button>
            )
          })}
        </div>
        <hr className="stat-rule-thin my-3" />
        <div className="space-y-0.5">
          {monster.saves.length ? (
            <p>
              <strong>Saving Throws</strong>{' '}
              {monster.saves.map((entry, i) =>
                Object.entries(entry).map(([name, bonus]) => (
                  <DiceHotButton
                    key={`${name}-${i}`}
                    className="mr-2"
                    onClick={() => dice.rollCheck(bonus, `${name} save`)}
                  >
                    {name} {formatModifier(bonus)}
                  </DiceHotButton>
                )),
              )}
            </p>
          ) : null}
          {monster.skills.length ? (
            <p>
              <strong>Skills</strong>{' '}
              {monster.skills.map((entry, i) =>
                Object.entries(entry).map(([name, bonus]) => (
                  <DiceHotButton
                    key={`${name}-${i}`}
                    className="mr-2"
                    onClick={() => dice.rollCheck(bonus, name)}
                  >
                    {name} {formatModifier(bonus)}
                  </DiceHotButton>
                )),
              )}
            </p>
          ) : null}
          <Defense label="Damage Vulnerabilities" value={monster.damage_vulnerabilities} />
          <Defense label="Damage Resistances" value={monster.damage_resistances} />
          <Defense label="Damage Immunities" value={monster.damage_immunities} />
          <Defense label="Condition Immunities" value={monster.condition_immunities} />
          <p>
            <strong>Senses</strong> {monster.senses}
          </p>
          <p>
            <strong>Languages</strong> {monster.languages}
          </p>
          <p>
            <strong>Challenge</strong>{' '}
            <span className="font-display text-parchment bg-oxblood-dark rounded-full px-2 py-0.5 text-xs tracking-wider">
              CR {monster.cr}
            </span>
          </p>
        </div>
        <FeatureList items={monster.traits} />
        {monster.actions.length ? (
          <Section title="Actions">
            <FeatureList items={monster.actions} />
          </Section>
        ) : null}
        {monster.reactions.length ? (
          <Section title="Reactions">
            <FeatureList items={monster.reactions} />
          </Section>
        ) : null}
        {monster.legendary_actions.length ? (
          <Section title="Legendary Actions">
            <FeatureList items={monster.legendary_actions} />
          </Section>
        ) : null}
        {monster.spells.length ? (
          <Section title="Spells">
            <FeatureList items={monster.spells} />
          </Section>
        ) : null}
      </div>

      {(monster.lore || monster.tactics || monster.drops) && (
        <div className="anim-rise delay-2 grid gap-6 lg:col-span-2">
          {monster.lore ? <LoreBlock title="Lore" Icon={ScrollText} text={monster.lore} /> : null}
          {monster.tactics ? (
            <LoreBlock title="Tactics" Icon={Swords} text={monster.tactics} />
          ) : null}
          {monster.drops ? <LoreBlock title="Drops" Icon={Gem} text={monster.drops} /> : null}
        </div>
      )}
    </article>
  )
}
