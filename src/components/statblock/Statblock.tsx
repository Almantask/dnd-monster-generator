import type { ReactNode } from 'react'
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
    <section className="mt-3">
      <h3 className="font-display text-lg font-bold tracking-wide text-oxblood uppercase">{title}</h3>
      <hr className="stat-rule mb-2" />
      {children}
    </section>
  )
}

function FeatureList({ items }: { items: NamedFeature[] }) {
  const dice = useDice()
  if (!items.length) return null
  return (
    <div className="space-y-2">
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

export function Statblock({
  monster,
  imageUrl,
}: {
  monster: Monster
  imageUrl?: string | null
}) {
  const dice = useDice()
  const hitDice = parseDiceExpressions(monster.hit_dice)[0]

  return (
    <article className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
      <div className="overflow-hidden rounded border border-oxblood/30 bg-black/5">
        {imageUrl ? (
          <img src={imageUrl} alt={monster.name} className="h-full w-full object-cover object-top" />
        ) : (
          <div className="flex min-h-80 items-center justify-center p-6 text-center italic text-ink/50">
            No illustration in this entry.
          </div>
        )}
      </div>
      <div className="rounded border border-oxblood/40 bg-statblock p-5 shadow-md">
        <h2 className="font-display text-3xl font-bold tracking-wide text-oxblood uppercase">
          {monster.name}
        </h2>
        <p className="italic">{typeLine(monster)}</p>
        <hr className="stat-rule my-2" />
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
        <hr className="stat-rule-thin my-2" />
        <div className="grid grid-cols-6 gap-1 text-center">
          {ABILITY_ABBREV.map((abbrev, index) => {
            const score = monster.stats[index] ?? 10
            const mod = abilityModifier(score)
            return (
              <button
                key={abbrev}
                type="button"
                className="dice-hot relative py-1"
                onClick={() => dice.rollCheck(mod, abbrev)}
              >
                <div className="flex items-center justify-center gap-0.5 font-display text-xs font-bold text-oxblood">
                  {abbrev}
                  <DiceMarker />
                </div>
                <div>
                  {score} ({formatModifier(mod)})
                </div>
              </button>
            )
          })}
        </div>
        <hr className="stat-rule-thin my-2" />
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
          <strong>Challenge</strong> {monster.cr}
        </p>
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
        <div className="space-y-6 lg:col-span-2">
          {monster.lore ? (
            <section>
              <h3 className="font-display text-xl font-bold text-oxblood uppercase">Lore</h3>
              <hr className="stat-rule mb-2" />
              <p className="whitespace-pre-wrap">{monster.lore}</p>
            </section>
          ) : null}
          {monster.tactics ? (
            <section>
              <h3 className="font-display text-xl font-bold text-oxblood uppercase">Tactics</h3>
              <hr className="stat-rule mb-2" />
              <p className="whitespace-pre-wrap">{monster.tactics}</p>
            </section>
          ) : null}
          {monster.drops ? (
            <section>
              <h3 className="font-display text-xl font-bold text-oxblood uppercase">Drops</h3>
              <hr className="stat-rule mb-2" />
              <p className="whitespace-pre-wrap">{monster.drops}</p>
            </section>
          ) : null}
        </div>
      )}
    </article>
  )
}
