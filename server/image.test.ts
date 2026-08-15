import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateImage } from './image.ts'

const input = {
  name: 'Ash Wyrm',
  description: 'A soot-scaled dragonet with ember eyes.',
  type: 'dragon',
  size: 'Small',
}

const pngB64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function imageResponse(bytes = 1200) {
  return new Response(new Uint8Array(bytes).fill(7), {
    status: 200,
    headers: { 'Content-Type': 'image/jpeg' },
  })
}

describe('generateImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses Gemini 2.5 Flash Image when the AI Studio key works', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('generativelanguage.googleapis.com')) {
        return jsonResponse({
          candidates: [
            {
              content: {
                parts: [{ inlineData: { mimeType: 'image/png', data: pngB64 } }],
              },
            },
          ],
        })
      }
      return new Response('unexpected', { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateImage(input, { env: { GEMINI_API_KEY: 'studio-key' } })

    expect(result.provider).toBe('gemini')
    expect(result.mime).toBe('image/png')
    expect(result.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('gemini-2.5-flash-image')
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('pollinations'))).toBe(
      false,
    )
  })

  it('falls back to Pollinations when Gemini fails', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('generativelanguage.googleapis.com')) {
        return new Response('quota', { status: 429 })
      }
      if (href.includes('pollinations.ai')) return imageResponse()
      return new Response('unexpected', { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateImage(input, { env: { GEMINI_API_KEY: 'studio-key' } })

    expect(result.provider).toBe('pollinations')
    expect(result.mime).toBe('image/jpeg')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('generativelanguage.googleapis.com')
  })

  it('skips Gemini and uses Pollinations when no AI Studio key is set', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('pollinations.ai')) return imageResponse()
      return new Response('unexpected', { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateImage(input, { env: {} })

    expect(result.provider).toBe('pollinations')
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('googleapis'))).toBe(false)
  })
})
