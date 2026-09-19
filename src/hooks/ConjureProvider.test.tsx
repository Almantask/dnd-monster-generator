/** @vitest-environment jsdom */
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { GeneratedMonster } from '@shared/monsterSchema.ts'
import { DiceProvider } from './DiceProvider.tsx'
import { ConjureProvider } from './ConjureProvider.tsx'
import { AppShell } from '@/components/layout/AppShell.tsx'
import { ConjurePage } from '@/pages/ConjurePage.tsx'

const generatedMonster = {
  name: 'Ashfang',
  size: 'Large',
  type: 'dragon',
  subtype: null,
  alignment: 'chaotic evil',
  ac: 17,
  hp: 90,
  hit_dice: '12d10+24',
  speed: '40 ft., fly 80 ft.',
  stats: [19, 14, 17, 12, 13, 15],
  saves: [],
  skills: [],
  damage_vulnerabilities: null,
  damage_resistances: 'fire',
  damage_immunities: null,
  condition_immunities: null,
  senses: 'darkvision 60 ft., passive Perception 11',
  languages: 'Draconic',
  cr: '5',
  spells: [],
  traits: [],
  actions: [],
  reactions: [],
  legendary_actions: [],
  habitat: 'Mountain',
  archetype: 'Brute',
  locomotion: ['Flying'],
  group: 'Solo',
  personality: 'Aggressive',
  lore: 'A cinder drake.',
  tactics: 'Breathes fire.',
  drops: 'Scale',
} as GeneratedMonster

let resolveStatblock: (value: GeneratedMonster) => void = () => {}
let rejectStatblock: (reason?: unknown) => void = () => {}
let finishImage: (error?: Error) => void = () => {}

const generateStatblock = vi.fn(
  () =>
    new Promise<GeneratedMonster>((resolve, reject) => {
      resolveStatblock = resolve
      rejectStatblock = reject
    }),
)
const generateImage = vi.fn(
  () =>
    new Promise<{ mime: string; dataUrl: string }>((_resolve, reject) => {
      finishImage = (error = new Error('skip art')) => reject(error)
    }),
)
const saveMonster = vi.fn(async () => undefined)
const saveImage = vi.fn(async () => 'img_1')

vi.mock('@/lib/api.ts', () => ({
  generateStatblock: (input: unknown) => generateStatblock(input),
  generateImage: (input: unknown) => generateImage(input),
  dataUrlToBlob: () => new Blob(),
}))

vi.mock('@/lib/storage.ts', () => ({
  saveMonster: (monster: unknown) => saveMonster(monster),
  saveImage: (blob: unknown, mime: unknown) => saveImage(blob, mime),
}))

function renderApp(initialEntries = ['/conjure']) {
  return render(
    <DiceProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <ConjureProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<p>Bestiary page</p>} />
              <Route path="/conjure" element={<ConjurePage />} />
              <Route path="/scribe" element={<p>Scribe page</p>} />
              <Route path="/settings" element={<p>Settings page</p>} />
              <Route path="/monster/:id" element={<p>Monster page</p>} />
            </Route>
          </Routes>
        </ConjureProvider>
      </MemoryRouter>
    </DiceProvider>,
  )
}

async function fillAndSubmit() {
  await userEvent.type(screen.getByPlaceholderText(/Ashfang, the Cinder Drake/), 'Ashfang')
  await userEvent.type(
    screen.getByPlaceholderText(/Visuals, abilities, traits/),
    'A cinder drake coiled around a ruined tower.',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Conjure' }))
}

describe('ConjureProvider tab persistence', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn()
    generateStatblock.mockClear()
    generateImage.mockClear()
    saveMonster.mockClear()
    saveImage.mockClear()
    generateStatblock.mockImplementation(
      () =>
        new Promise<GeneratedMonster>((resolve, reject) => {
          resolveStatblock = resolve
          rejectStatblock = reject
        }),
    )
    generateImage.mockImplementation(
      () =>
        new Promise<{ mime: string; dataUrl: string }>((_resolve, reject) => {
          finishImage = (error = new Error('skip art')) => reject(error)
        }),
    )
  })

  it('keeps the conjure form filled after switching tabs', async () => {
    renderApp()

    await userEvent.type(screen.getByPlaceholderText(/Ashfang, the Cinder Drake/), 'Ashfang')
    await userEvent.type(
      screen.getByPlaceholderText(/Visuals, abilities, traits/),
      'A cinder drake coiled around a ruined tower.',
    )

    await userEvent.click(screen.getByRole('link', { name: 'Bestiary' }))
    expect(screen.getByText('Bestiary page')).toBeTruthy()

    await userEvent.click(screen.getByRole('link', { name: 'Conjure' }))
    expect(screen.getByPlaceholderText(/Ashfang, the Cinder Drake/)).toHaveValue('Ashfang')
    expect(screen.getByPlaceholderText(/Visuals, abilities, traits/)).toHaveValue(
      'A cinder drake coiled around a ruined tower.',
    )
  })

  it('keeps generating after switching tabs and still saves the monster', async () => {
    renderApp()
    await fillAndSubmit()

    expect(screen.getByRole('dialog', { name: 'Inscribing Statblock' })).toBeTruthy()
    expect(generateStatblock).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('link', { name: 'Bestiary' }))
    expect(screen.getByText('Bestiary page')).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Inscribing Statblock' })).toBeNull()
    expect(screen.getByText(/Conjuration continues while you browse/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Conjure (generating)' })).toBeTruthy()

    await userEvent.click(screen.getByRole('link', { name: 'Conjure (generating)' }))
    expect(screen.getByRole('dialog', { name: 'Inscribing Statblock' })).toBeTruthy()
    await userEvent.click(screen.getByRole('link', { name: 'Bestiary' }))
    expect(screen.getByText(/Conjuration continues while you browse/)).toBeTruthy()

    await act(async () => {
      resolveStatblock(generatedMonster)
    })

    await waitFor(() => {
      expect(screen.getByText(/Summoning the likeness/)).toBeTruthy()
    })

    await act(async () => {
      finishImage()
    })

    await waitFor(() => {
      expect(saveMonster).toHaveBeenCalled()
      expect(screen.getByText('Monster page')).toBeTruthy()
    })
  })

  it('returns to Conjure with the error if generation fails on another tab', async () => {
    renderApp()
    await fillAndSubmit()
    await userEvent.click(screen.getByRole('link', { name: 'Scribe' }))
    expect(screen.getByText('Scribe page')).toBeTruthy()

    await act(async () => {
      rejectStatblock(new Error('The weave faltered'))
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('The weave faltered')
    expect(screen.getByPlaceholderText(/Ashfang, the Cinder Drake/)).toHaveValue('Ashfang')
  })
})
