import { NavLink, Outlet } from 'react-router-dom'
import { DiceTray } from '@/components/dice/DiceTray.tsx'

const links = [
  { to: '/', label: 'Bestiary' },
  { to: '/conjure', label: 'Conjure' },
  { to: '/scribe', label: 'Scribe' },
  { to: '/settings', label: 'Settings' },
]

export function AppShell() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-28 pt-6">
      <header className="mb-8 border-b-2 border-oxblood pb-4 text-center">
        <p className="font-display text-xs tracking-[0.4em] text-oxblood uppercase">
          A custom D&D monsters generator
        </p>
        <h1 className="font-display text-4xl font-bold text-oxblood-dark md:text-5xl">
          The Bestiary
        </h1>
        <nav className="mt-4 flex flex-wrap justify-center gap-3 font-display text-sm tracking-widest uppercase">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `rounded px-3 py-1 ${isActive ? 'bg-oxblood text-parchment' : 'text-oxblood hover:bg-oxblood/10'}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <DiceTray />
    </div>
  )
}
