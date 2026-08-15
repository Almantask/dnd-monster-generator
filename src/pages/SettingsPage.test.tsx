/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage.tsx'

vi.mock('@/lib/api.ts', () => ({
  fetchStatus: vi.fn(async () => ({
    gemini: true,
    openrouter: true,
    pollinations: false,
    huggingface: false,
    passphraseRequired: false,
  })),
}))

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows Gemini Flash Image as the primary portrait provider', async () => {
    render(<SettingsPage />)
    expect(await screen.findByText(/Gemini Flash Image: configured/)).toBeTruthy()
    expect(screen.getByText(/Pollinations: anonymous flux \(ok\)/)).toBeTruthy()
  })
})
