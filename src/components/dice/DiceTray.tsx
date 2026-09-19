import { Dices, Eraser } from 'lucide-react'
import { useDice } from '@/hooks/useDice.ts'

export function DiceTray() {
  const { rolls, clear } = useDice()

  return (
    <aside aria-label="Dice tray" className="tray fixed inset-x-0 bottom-0 z-30 px-4 py-2">
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <p className="font-display text-oxblood flex shrink-0 items-center gap-1.5 text-xs tracking-widest uppercase">
          <Dices
            className={`size-4 ${rolls.length ? '' : 'float-slow'}`}
            aria-hidden="true"
            strokeWidth={2.25}
          />
          <span className="hidden sm:inline">Dice tray</span>
        </p>
        <ul
          className={`tray-scroller flex min-h-10 min-w-0 flex-1 items-center gap-2 ${
            rolls.length ? 'tray-fade' : ''
          }`}
        >
          {rolls.length === 0 ? (
            <li className="text-ink/60 text-sm italic">
              Click a stat, attack, or dice expression to roll.
            </li>
          ) : (
            rolls.map((roll, index) => (
              <li
                key={roll.id}
                className={`roll-chip shrink-0 px-2 py-1 text-sm whitespace-nowrap ${
                  index === 0 ? 'anim-pop roll-chip-latest' : ''
                }`}
              >
                <span className="font-display text-oxblood">{roll.expression}</span>{' '}
                <strong className="text-oxblood-dark">{roll.total}</strong>
                <span className="text-ink/60"> [{roll.dice.join(', ')}]</span>
              </li>
            ))
          )}
        </ul>
        {rolls.length > 0 ? (
          <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={clear}>
            <Eraser className="size-3.5" aria-hidden="true" />
            Clear
          </button>
        ) : null}
      </div>
    </aside>
  )
}
