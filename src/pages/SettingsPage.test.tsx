/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage.tsx'

vi.mock('@/lib/api.ts', () => ({
  fetchStatus: vi.fn(async () => ({
    gemini: true,
    openrouter: true,
    cloudflare: true,
    pollinations: false,
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
      await screen.findByText(/Google AI Studio \(Gemini Flash \+ Gemini images\): configured/),
    ).toBeTruthy()
    expect(screen.getByText(/Cloudflare Workers AI \(free FLUX\): configured/)).toBeTruthy()
    expect(screen.getByText(/Pollinations \(FLUX fallback\): anonymous \(legacy endpoint\)/)).toBeTruthy()
  })

  it('shows quota exceeded notice when Gemini quota is exceeded', async () => {
    const { fetchStatus } = await import('@/lib/api.ts')
    vi.mocked(fetchStatus).mockResolvedValueOnce({
      gemini: true,
      geminiQuotaExceeded: true,
      geminiQuotaResetInMs: 45000,
      openrouter: true,
      cloudflare: false,
      pollinations: false,
      passphraseRequired: false,
    })

    render(<SettingsPage />)
    expect(
      await screen.findByText(
        /Google AI Studio \(Gemini Flash \+ Gemini images\): quota exceeded \(using fallback\)/,
      ),
    ).toBeTruthy()
  })
})
