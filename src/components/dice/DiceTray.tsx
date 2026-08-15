import { useDice } from '@/hooks/useDice.ts'

export function DiceTray() {
  const { rolls, clear } = useDice()

  return (
    <aside
      aria-label="Dice tray"
      className="fixed inset-x-0 bottom-0 border-t-2 border-oxblood bg-statblock/95 px-4 py-2 shadow-[0_-8px_24px_rgba(80,40,0,0.2)]"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <p className="font-display text-xs tracking-widest text-oxblood uppercase">Dice tray</p>
        <ul className="flex min-h-10 flex-1 flex-wrap items-center gap-2 overflow-x-auto">
          {rolls.length === 0 ? (
            <li className="text-sm italic text-ink/60">Click a stat, attack, or dice expression to roll.</li>
          ) : (
            rolls.map((roll, index) => (
              <li
                key={`${roll.expression}-${index}`}
                className="rounded border border-rule/40 bg-parchment px-2 py-1 text-sm"
              >
                <span className="font-display text-oxblood">{roll.expression}</span>{' '}
                <strong>{roll.total}</strong>
                <span className="text-ink/60"> [{roll.dice.join(', ')}]</span>
              </li>
            ))
          )}
        </ul>
        {rolls.length > 0 ? (
          <button type="button" className="font-display text-xs text-oxblood uppercase" onClick={clear}>
            Clear
          </button>
        ) : null}
      </div>
    </aside>
  )
}
