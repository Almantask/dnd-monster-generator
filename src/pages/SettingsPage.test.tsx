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

  it('shows Google AI Studio as configured provider', async () => {
    render(<SettingsPage />)
    expect(
      await screen.findByText(/Google AI Studio \(Gemini 2\.5 Flash \+ Imagen\): configured/),
    ).toBeTruthy()
    expect(screen.getByText(/Pollinations \(FLUX fallback\): anonymous flux \(active\)/)).toBeTruthy()
  })
})
