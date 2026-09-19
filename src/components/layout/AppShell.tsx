import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookOpen, Flame, LoaderCircle, ScrollText, Settings as SettingsIcon } from 'lucide-react'
import { DiceTray } from '@/components/dice/DiceTray.tsx'
import { useConjure } from '@/hooks/useConjure.ts'

const links = [
  { to: '/', label: 'Bestiary', Icon: BookOpen },
  { to: '/conjure', label: 'Conjure', Icon: Flame },
  { to: '/scribe', label: 'Scribe', Icon: ScrollText },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
]

export function AppShell() {
  const location = useLocation()
  const { busy } = useConjure()

  // HashRouter keeps the old scroll offset between pages; with the nav pinned
  // on screen that would drop people mid-way down the next page.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pt-8 pb-28">
      <header className="anim-fade mb-5 text-center">
        <p className="eyebrow flex items-center justify-center gap-2 text-[0.6rem] tracking-[0.2em] sm:text-[0.7rem] sm:tracking-[0.38em]">
          <span aria-hidden="true" className="twinkle text-gold">
            ✦
          </span>
          A custom D&amp;D monsters generator
          <span aria-hidden="true" className="twinkle-2 text-gold">
            ✦
          </span>
        </p>
        <h1 className="title-tome font-display mt-1 text-4xl font-bold md:text-5xl">
          The Bestiary
        </h1>
        <div className="flourish mx-auto mt-3 max-w-md" aria-hidden="true">
          <span className="twinkle-3 text-sm">❖</span>
        </div>
      </header>

      <div className="sticky top-3 z-[60] mb-8 flex justify-center">
        <nav className="nav-bar flex justify-center gap-0.5 p-1 sm:gap-1">
          {links.map(({ to, label, Icon }) => {
            const generating = to === '/conjure' && busy !== 'idle'
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                aria-label={generating ? 'Conjure (generating)' : undefined}
                className={({ isActive }) =>
                  `nav-link font-display flex flex-col items-center gap-0.5 px-3 text-[0.62rem] tracking-wider uppercase sm:flex-row sm:gap-1.5 sm:px-4 sm:text-sm sm:tracking-widest ${
                    isActive ? 'nav-link-active' : ''
                  }`
                }
              >
                {generating ? (
                  <LoaderCircle
                    className="size-3.5 animate-spin"
                    aria-hidden="true"
                    strokeWidth={2.25}
                  />
                ) : (
                  <Icon className="size-3.5" aria-hidden="true" strokeWidth={2.25} />
                )}
                {label}
              </NavLink>
            )
          })}
        </nav>
      </div>

      {/* Keyed on the path so each navigation replays the entrance animation. */}
      <main key={location.pathname} className="anim-rise flex-1">
        <Outlet />
      </main>

      <DiceTray />
    </div>
  )
}
