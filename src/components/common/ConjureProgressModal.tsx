import { useEffect, useState } from 'react'
import { KoboldRunner } from './KoboldRunner.tsx'
import { getHintForSeconds } from './conjureHints.ts'

export function ConjureProgressModal({
  busy,
  name,
}: {
  busy: 'stats' | 'art'
  name?: string
}) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    setSeconds(0)
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const currentHint = getHintForSeconds(seconds)
  // Progress fills up to 96% over 20s, holding until response arrives
  const progressPercent = Math.min(96, Math.round((seconds / 20) * 100))

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conjure-progress-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/75 p-4 backdrop-blur-xs animate-fadeIn"
    >
      <div className="relative w-full max-w-lg rounded-lg border-2 border-oxblood bg-statblock p-6 shadow-2xl">
        {/* Parchment corner accents */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-oxblood/60" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-oxblood/60" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-oxblood/60" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-oxblood/60" />

        {/* Header */}
        <div className="text-center">
          <h3
            id="conjure-progress-title"
            className="font-display text-xl uppercase tracking-wider text-oxblood"
          >
            {busy === 'stats' ? 'Inscribing Statblock' : 'Painting Likeness'}
          </h3>
          <p className="text-xs text-ink/70 italic mt-0.5">
            {name ? `Summoning "${name}" into the Bestiary` : 'Weaving arcane threads of creation'}
          </p>
        </div>

        <hr className="stat-rule my-4" />

        {/* Animated Kobold Running Arena */}
        <div className="relative my-3 flex flex-col items-center justify-center overflow-hidden rounded border border-oxblood/20 bg-parchment/60 py-4 px-2">
          {/* Running Kobold */}
          <KoboldRunner className="w-36 h-28" />

          {/* Running track decor */}
          <div className="w-full px-6 mt-1 flex items-center justify-between text-[11px] font-display uppercase tracking-widest text-oxblood/60">
            <span>Grimoire</span>
            <span className="animate-pulse text-oxblood">✦ ✦ ✦</span>
            <span>Bestiary</span>
          </div>
        </div>

        {/* 20s Progress Bar */}
        <div className="space-y-1.5 mt-4">
          <div className="flex justify-between text-xs font-display text-oxblood uppercase">
            <span>Arcane Weaver</span>
            <span>{seconds}s / 20s</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full border border-oxblood/40 bg-parchment p-0.5">
            <div
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-full rounded-full bg-linear-to-r from-oxblood/80 to-oxblood transition-all duration-1000 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Dynamic Hints (Spanning 20s and ending with "almost there") */}
        <div
          role="status"
          aria-live="polite"
          className="mt-4 min-h-[44px] flex items-center justify-center text-center px-2 py-2 rounded bg-parchment/40 border border-oxblood/20"
        >
          <p
            key={currentHint}
            className={`font-body text-sm text-ink ${
              currentHint === 'Almost there…' ? 'font-semibold text-oxblood animate-pulse' : 'italic'
            }`}
          >
            &ldquo;{currentHint}&rdquo;
          </p>
        </div>
      </div>
    </div>
  )
}
