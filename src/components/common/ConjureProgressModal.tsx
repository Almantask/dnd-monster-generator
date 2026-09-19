import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame, LoaderCircle } from 'lucide-react'
import { KoboldRunner } from './KoboldRunner.tsx'
import { getHintForSeconds } from './conjureHints.ts'

function useElapsedSeconds(startedAt?: number | null) {
  const originRef = useRef(startedAt ?? Date.now())
  const [seconds, setSeconds] = useState(() =>
    Math.max(0, Math.floor((Date.now() - (startedAt ?? originRef.current)) / 1000)),
  )

  useEffect(() => {
    originRef.current = startedAt ?? originRef.current
    const tick = () => {
      setSeconds(Math.max(0, Math.floor((Date.now() - originRef.current) / 1000)))
    }
    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [startedAt])

  return seconds
}

export function ConjureProgressModal({
  busy,
  name,
  startedAt,
}: {
  busy: 'stats' | 'art'
  name?: string
  startedAt?: number | null
}) {
  const seconds = useElapsedSeconds(startedAt)
  const currentHint = getHintForSeconds(seconds)
  // Progress fills up to 96% over 60s, holding until response arrives
  const progressPercent = Math.min(96, Math.round((seconds / 60) * 100))

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conjure-progress-title"
      className="anim-fade fixed inset-0 z-50 flex items-center justify-center bg-ink/75 p-4 backdrop-blur-xs"
    >
      <div className="panel anim-pop relative w-full max-w-lg border-2 border-oxblood p-6 shadow-2xl">
        {/* Parchment corner accents */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-oxblood/60" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-oxblood/60" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-oxblood/60" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-oxblood/60" />

        {/* Header */}
        <div className="text-center">
          <h3
            id="conjure-progress-title"
            className="title-tome font-display text-xl tracking-wider uppercase"
          >
            {busy === 'stats' ? 'Inscribing Statblock' : 'Painting Likeness'}
          </h3>
          <p className="text-xs text-ink/70 italic mt-0.5">
            {name ? `Summoning "${name}" into the Bestiary` : 'Weaving arcane threads of creation'}
          </p>
        </div>

        <hr className="stat-rule my-4" />

        {/* Animated Kobold Running Arena */}
        <div className="panel-inset relative my-3 flex flex-col items-center justify-center overflow-hidden px-2 py-4">
          {/* Running Kobold */}
          <KoboldRunner className="w-36 h-28" />

          {/* Running track decor */}
          <div className="w-full px-6 mt-1 flex items-center justify-between text-[11px] font-display uppercase tracking-widest text-oxblood/60">
            <span>Grimoire</span>
            <span className="text-oxblood" aria-hidden="true">
              <span className="twinkle inline-block">✦</span>{' '}
              <span className="twinkle-2 inline-block">✦</span>{' '}
              <span className="twinkle-3 inline-block">✦</span>
            </span>
            <span>Bestiary</span>
          </div>
        </div>

        {/* 60s Progress Bar */}
        <div className="space-y-1.5 mt-4">
          <div className="flex justify-between text-xs font-display text-oxblood uppercase">
            <span>Arcane Weaver</span>
            <span>{seconds}s / 60s</span>
          </div>
          <div className="progress-track h-3 w-full p-0.5">
            <div className="h-full overflow-hidden rounded-full">
              <div
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="progress-fill h-full w-full transition-transform duration-1000 ease-out"
                style={{ transform: `translateX(${progressPercent - 100}%)` }}
              />
            </div>
          </div>
        </div>

        {/* Dynamic Hints (Spanning 20s and ending with "almost there") */}
        <div
          role="status"
          aria-live="polite"
          className="panel-inset mt-4 flex min-h-[44px] items-center justify-center px-2 py-2 text-center"
        >
          <p
            key={currentHint}
            className={`anim-rise font-body text-sm text-ink ${
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

export function ConjureProgressBanner({
  busy,
  name,
  startedAt,
}: {
  busy: 'stats' | 'art'
  name?: string
  startedAt?: number | null
}) {
  const seconds = useElapsedSeconds(startedAt)
  const progressPercent = Math.min(96, Math.round((seconds / 60) * 100))
  const stage = busy === 'stats' ? 'Inscribing the statblock' : 'Summoning the likeness'

  return (
    <div
      role="status"
      aria-live="polite"
      className="anim-pop pointer-events-none fixed inset-x-0 top-[4.75rem] z-50 flex justify-center px-4"
    >
      <div className="panel pointer-events-auto w-full max-w-xl border-2 border-oxblood px-4 py-3 shadow-2xl">
        <div className="flex items-center gap-3">
          <LoaderCircle className="text-oxblood size-5 shrink-0 animate-spin" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-oxblood text-sm tracking-wider uppercase">
              {stage}
              {name ? ` — ${name}` : ''}
            </p>
            <p className="text-ink/70 truncate text-xs italic">
              Conjuration continues while you browse · {seconds}s
            </p>
            <div className="progress-track mt-2 h-1.5 w-full p-px">
              <div className="h-full overflow-hidden rounded-full">
                <div
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="progress-fill h-full w-full"
                  style={{ transform: `translateX(${progressPercent - 100}%)` }}
                />
              </div>
            </div>
          </div>
          <Link to="/conjure" className="btn btn-outline btn-sm shrink-0">
            <Flame className="size-3.5" aria-hidden="true" />
            Show
          </Link>
        </div>
      </div>
    </div>
  )
}
