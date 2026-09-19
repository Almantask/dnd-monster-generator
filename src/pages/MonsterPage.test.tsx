/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Monster } from '@shared/monsterSchema.ts'
import { DiceProvider } from '@/hooks/DiceProvider.tsx'
import { MonsterPage } from './MonsterPage.tsx'

const monster: Monster = {
  id: 'm1',
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
  imageBlobId: null,
  source: 'ai',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const exportStatblockPng = vi.fn(async () => undefined)
const exportStatblockPdf = vi.fn(async () => undefined)
const exportMonsters = vi.fn(async () => undefined)

vi.mock('@/lib/exportSheet.ts', () => ({
  exportStatblockPng: (node: HTMLElement, name: string) => exportStatblockPng(node, name),
  exportStatblockPdf: (node: HTMLElement, name: string) => exportStatblockPdf(node, name),
}))

vi.mock('@/lib/importExport.ts', () => ({
  exportMonsters: (rows: Monster[], asZip: boolean) => exportMonsters(rows, asZip),
}))

vi.mock('@/lib/storage.ts', () => ({
  getMonster: async () => monster,
  getImageUrl: async () => null,
  deleteMonster: vi.fn(),
  saveMonster: vi.fn(),
  saveImage: vi.fn(),
}))

vi.mock('@/lib/api.ts', () => ({
  generateImage: vi.fn(),
  dataUrlToBlob: vi.fn(),
}))

function renderPage() {
  return render(
    <DiceProvider>
      <MemoryRouter initialEntries={['/monster/m1']}>
        <Routes>
          <Route path="/monster/:id" element={<MonsterPage />} />
        </Routes>
      </MemoryRouter>
    </DiceProvider>,
  )
}

describe('MonsterPage exports', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn()
    exportStatblockPng.mockClear()
    exportStatblockPdf.mockClear()
    exportMonsters.mockClear()
  })

  it('exports the rendered sheet as PNG and PDF', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Ashfang' })).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Export PNG' }))
    await waitFor(() => {
      expect(exportStatblockPng).toHaveBeenCalledTimes(1)
    })
    expect(exportStatblockPng.mock.calls[0]?.[0]).toBeInstanceOf(HTMLElement)
    expect(exportStatblockPng.mock.calls[0]?.[1]).toBe('Ashfang')

    await userEvent.click(screen.getByRole('button', { name: 'Export PDF' }))
    await waitFor(() => {
      expect(exportStatblockPdf).toHaveBeenCalledTimes(1)
    })
    expect(exportStatblockPdf.mock.calls[0]?.[1]).toBe('Ashfang')

    await userEvent.click(screen.getByRole('button', { name: 'Export JSON' }))
    expect(exportMonsters).toHaveBeenCalledWith([monster], false)
  })
})
