/** @vitest-environment jsdom */
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { PasteJsonEditor } from './PasteJsonEditor.tsx'
import { EXAMPLE_STATBLOCK_JSON } from '@shared/importAdapter.ts'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockSaveMonster = vi.fn(async () => 'm_test_123')
const mockSaveImage = vi.fn(async () => 'img_test_123')

vi.mock('@/lib/storage.ts', () => ({
  saveMonster: (m: unknown) => mockSaveMonster(m),
  saveImage: (b: unknown, m: string) => mockSaveImage(b, m),
}))

describe('PasteJsonEditor', () => {
  it('renders JSON textarea and collapsible prompt instructions', () => {
    render(
      <MemoryRouter>
        <PasteJsonEditor />
      </MemoryRouter>,
    )

    expect(screen.getByText(/Paste Monster JSON/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Instructions: Statblock Generator Prompt/i })).toBeTruthy()
    expect(screen.getByLabelText(/Monster JSON/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Inscribe into Bestiary/i })).toBeTruthy()
  })

  it('can toggle prompt guide and insert example JSON', async () => {
    render(
      <MemoryRouter>
        <PasteJsonEditor />
      </MemoryRouter>,
    )

    const guideToggle = screen.getByRole('button', { name: /Instructions: Statblock Generator Prompt/i })
    fireEvent.click(guideToggle)

    expect(screen.getByText(/You are a statblock generator for D&D 5e/i)).toBeTruthy()

    const insertBtn = screen.getByRole('button', { name: /Insert Example JSON/i })
    fireEvent.click(insertBtn)

    const textarea = screen.getByLabelText(/Monster JSON/i) as HTMLTextAreaElement
    expect(textarea.value).toContain('Samogitian Knight')
  })

  it('saves monster and navigates when valid JSON is submitted', async () => {
    render(
      <MemoryRouter>
        <PasteJsonEditor />
      </MemoryRouter>,
    )

    const textarea = screen.getByLabelText(/Monster JSON/i)
    fireEvent.change(textarea, {
      target: { value: JSON.stringify(EXAMPLE_STATBLOCK_JSON) },
    })

    const submitBtn = screen.getByRole('button', { name: /Inscribe into Bestiary/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockSaveMonster).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/monster\//))
    })
  })

  it('shows an error message if JSON is malformed', async () => {
    render(
      <MemoryRouter>
        <PasteJsonEditor />
      </MemoryRouter>,
    )

    const textarea = screen.getByLabelText(/Monster JSON/i)
    fireEvent.change(textarea, {
      target: { value: '{"name": "Broken' },
    })

    const submitBtn = screen.getByRole('button', { name: /Inscribe into Bestiary/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })
  })
})
