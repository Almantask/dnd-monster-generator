import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLOUDFLARE_DAILY_LIMIT_MESSAGE, FREE_TIER_IMAGE_MESSAGE, generateImage } from './image.ts'
import { clearGeminiQuota, isGeminiQuotaExceeded } from './quota.ts'

const input = {
  name: 'Ash Wyrm',
  description: 'A soot-scaled dragonet with ember eyes.',
  type: 'dragon',
  size: 'Small',
}

const pngB64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

// Shape of the real AI Studio response for an image model on a project without billing.
const freeTierImageQuotaBody = JSON.stringify(
  {
    error: {
      code: 429,
      message:
        'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-3.1-flash-image',
      status: 'RESOURCE_EXHAUSTED',
    },
  },
  null,
  2,
)

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function geminiImageResponse() {
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

function imageResponse(bytes = 1200) {
  return new Response(new Uint8Array(bytes).fill(7), {
    status: 200,
    headers: { 'Content-Type': 'image/jpeg' },
  })
}

const calledUrls = (fetchMock: { mock: { calls: unknown[][] } }) =>
  fetchMock.mock.calls.map((call) => String(call[0]))

const cloudflareEnv = {
  GEMINI_API_KEY: 'studio-key',
  CLOUDFLARE_ACCOUNT_ID: 'acct-123',
  CLOUDFLARE_API_TOKEN: 'cf-token',
}

const cloudflareRunUrl = (model: string) =>
  `https://api.cloudflare.com/client/v4/accounts/acct-123/ai/run/@cf/black-forest-labs/${model}`

function cloudflareImageResponse(b64 = pngB64) {
  return jsonResponse({ result: { image: b64 }, success: true, errors: [], messages: [] })
}

const googleFreeTier = () => new Response(freeTierImageQuotaBody, { status: 429 })

type FetchArgs = [url: string | URL | Request, init?: RequestInit]

const cloudflareCalls = (fetchMock: { mock: { calls: FetchArgs[] } }) =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes('api.cloudflare.com'))

describe('generateImage', () => {
  beforeEach(() => {
    clearGeminiQuota()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearGeminiQuota()
  })

  it('uses a native Gemini image model first when the AI Studio key works', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes(':generateContent')) return geminiImageResponse()
      return new Response('unexpected', { status: 500 })
    })

    const result = await generateImage(input, {
      env: { GEMINI_API_KEY: 'studio-key' },
      fetch: fetchMock,
    })

    expect(result.provider).toBe('gemini')
    expect(result.mime).toBe('image/png')
    expect(result.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    expect(calledUrls(fetchMock)).toEqual([
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent',
    ])
  })

  it('falls back to Imagen when the Gemini image models are unavailable', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes(':generateContent')) return new Response('not found', { status: 404 })
      if (href.includes('imagen-4.0-generate-001:predict')) {
        return jsonResponse({ predictions: [{ bytesBase64Encoded: pngB64, mimeType: 'image/png' }] })
      }
      return new Response('unexpected', { status: 500 })
    })

    const result = await generateImage(input, {
      env: { GEMINI_API_KEY: 'studio-key' },
      fetch: fetchMock,
    })

    expect(result.provider).toBe('imagen')
    expect(calledUrls(fetchMock).some((url) => url.includes('pollinations'))).toBe(false)
  })

  it('uses the GEMINI_IMAGE_MODEL override first', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes(':generateContent')) return geminiImageResponse()
      return new Response('unexpected', { status: 500 })
    })

    const result = await generateImage(input, {
      env: {
        GEMINI_API_KEY: 'studio-key',
        GEMINI_IMAGE_MODEL: 'gemini-2.5-flash-image',
      },
      fetch: fetchMock,
    })

    expect(result.provider).toBe('gemini')
    expect(calledUrls(fetchMock)[0]).toContain('gemini-2.5-flash-image')
  })

  it('stops at the first free-tier limit-0 response instead of trying every Google image model', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('generativelanguage.googleapis.com')) {
        return new Response(freeTierImageQuotaBody, { status: 429 })
      }
      if (href.includes('pollinations.ai')) return imageResponse()
      return new Response('unexpected', { status: 500 })
    })

    const result = await generateImage(input, {
      env: { GEMINI_API_KEY: 'studio-key' },
      fetch: fetchMock,
    })

    expect(result.provider).toBe('pollinations')
    expect(calledUrls(fetchMock).filter((url) => url.includes('googleapis'))).toHaveLength(1)
  })

  it('reports that billing is required when a free-tier key cannot generate images and fallbacks fail', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('generativelanguage.googleapis.com')) {
        return new Response(freeTierImageQuotaBody, { status: 429 })
      }
      return new Response('down', { status: 500 })
    })

    await expect(
      generateImage(input, { env: { GEMINI_API_KEY: 'studio-key' }, fetch: fetchMock }),
    ).rejects.toThrow(FREE_TIER_IMAGE_MESSAGE)
  })

  it('does not put statblock Gemini into quota cooldown when image quota is exhausted', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('generativelanguage.googleapis.com')) {
        return new Response('Quota exceeded (RESOURCE_EXHAUSTED)', { status: 429 })
      }
      if (href.includes('pollinations.ai')) return imageResponse()
      return new Response('unexpected', { status: 500 })
    })

    const result = await generateImage(input, {
      env: { GEMINI_API_KEY: 'studio-key' },
      fetch: fetchMock,
    })

    expect(result.provider).toBe('pollinations')
    expect(calledUrls(fetchMock)[0]).toContain('generativelanguage.googleapis.com')
    expect(isGeminiQuotaExceeded()).toBe(false)
  })

  it('uses Cloudflare Workers AI FLUX.2 klein for a 3:4 portrait when Gemini has no image quota', async () => {
    const fetchMock = vi.fn(async (...[url]: FetchArgs) => {
      const href = String(url)
      if (href.includes('googleapis.com')) return googleFreeTier()
      if (href.includes('api.cloudflare.com')) return cloudflareImageResponse()
      return imageResponse()
    })

    const result = await generateImage(input, { env: cloudflareEnv, fetch: fetchMock })

    expect(result.provider).toBe('cloudflare')
    expect(result.mime).toBe('image/png')
    const calls = cloudflareCalls(fetchMock)
    expect(calls).toHaveLength(1)
    const [url, init] = calls[0]!
    expect(String(url)).toBe(cloudflareRunUrl('flux-2-klein-4b'))
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer cf-token' })
    expect(init?.body).toBeInstanceOf(FormData)
    const form = init?.body as FormData
    expect(form.get('width')).toBe('768')
    expect(form.get('height')).toBe('1024')
    expect(String(form.get('prompt'))).toContain('Ash Wyrm')
    expect(calledUrls(fetchMock).some((href) => href.includes('pollinations'))).toBe(false)
  })

  it('skips Cloudflare unless both the account id and API token are set', async () => {
    const fetchMock = vi.fn(async (...[url]: FetchArgs) => {
      if (String(url).includes('pollinations.ai')) return imageResponse()
      return new Response('unexpected', { status: 500 })
    })

    const result = await generateImage(input, {
      env: { CLOUDFLARE_API_TOKEN: 'cf-token' },
      fetch: fetchMock,
    })

    expect(result.provider).toBe('pollinations')
    expect(cloudflareCalls(fetchMock)).toHaveLength(0)
  })

  it('falls back from FLUX.2 klein to FLUX.1 schnell with a JSON body', async () => {
    const jpegB64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]).toString('base64')
    const fetchMock = vi.fn(async (...[url]: FetchArgs) => {
      const href = String(url)
      if (href.includes('googleapis.com')) return googleFreeTier()
      if (href.includes('flux-2-klein-4b')) return new Response('upstream error', { status: 500 })
      if (href.includes('flux-1-schnell')) return cloudflareImageResponse(jpegB64)
      return imageResponse()
    })

    const result = await generateImage(input, { env: cloudflareEnv, fetch: fetchMock })

    expect(result.provider).toBe('cloudflare')
    expect(result.mime).toBe('image/jpeg')
    const calls = cloudflareCalls(fetchMock)
    expect(calls.map(([url]) => String(url))).toEqual([
      cloudflareRunUrl('flux-2-klein-4b'),
      cloudflareRunUrl('flux-1-schnell'),
    ])
    const init = calls[1]![1]
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(JSON.parse(String(init?.body))).toMatchObject({ steps: 4 })
  })

  it('moves on to Pollinations without trying other Cloudflare models once the daily neurons are used up', async () => {
    const dailyLimitBody = JSON.stringify({
      success: false,
      errors: [
        {
          code: 4006,
          message:
            "AiError: you have used up your daily free allocation of 10,000 neurons, please upgrade to Cloudflare's Workers Paid plan if you would like to continue usage.",
        },
      ],
    })
    const fetchMock = vi.fn(async (...[url]: FetchArgs) => {
      const href = String(url)
      if (href.includes('googleapis.com')) return googleFreeTier()
      if (href.includes('api.cloudflare.com')) return new Response(dailyLimitBody, { status: 429 })
      return imageResponse()
    })

    const result = await generateImage(input, { env: cloudflareEnv, fetch: fetchMock })

    expect(result.provider).toBe('pollinations')
    expect(cloudflareCalls(fetchMock)).toHaveLength(1)
  })

  it('reports the Cloudflare daily limit when every provider fails', async () => {
    const fetchMock = vi.fn(async (...[url]: FetchArgs) => {
      const href = String(url)
      if (href.includes('googleapis.com')) return googleFreeTier()
      if (href.includes('api.cloudflare.com')) {
        return new Response('{"errors":[{"code":4006,"message":"daily free allocation used"}]}', { status: 429 })
      }
      return new Response('down', { status: 500 })
    })

    await expect(generateImage(input, { env: cloudflareEnv, fetch: fetchMock })).rejects.toThrow(
      CLOUDFLARE_DAILY_LIMIT_MESSAGE,
    )
  })

  it('does not try other Cloudflare models when the API token is rejected', async () => {
    const fetchMock = vi.fn(async (...[url]: FetchArgs) => {
      const href = String(url)
      if (href.includes('googleapis.com')) return googleFreeTier()
      if (href.includes('api.cloudflare.com')) return new Response('Authentication error', { status: 401 })
      return imageResponse()
    })

    const result = await generateImage(input, { env: cloudflareEnv, fetch: fetchMock })

    expect(result.provider).toBe('pollinations')
    expect(cloudflareCalls(fetchMock)).toHaveLength(1)
  })

  it('uses the Pollinations gen API with the secret key when one is set', async () => {
    const fetchMock = vi.fn(async (...[url]: FetchArgs) => {
      if (String(url).includes('gen.pollinations.ai')) return imageResponse()
      return new Response('unexpected', { status: 500 })
    })

    const result = await generateImage(input, {
      env: { POLLINATIONS_API_KEY: 'sk_test' },
      fetch: fetchMock,
    })

    expect(result.provider).toBe('pollinations')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toContain('https://gen.pollinations.ai/image/')
    expect(init?.headers).toEqual({ Authorization: 'Bearer sk_test' })
  })

  it('falls back to the legacy Pollinations endpoint without sending the secret key', async () => {
    const fetchMock = vi.fn(async (...[url]: FetchArgs) => {
      if (String(url).includes('gen.pollinations.ai')) return new Response('payment required', { status: 402 })
      if (String(url).includes('image.pollinations.ai')) return imageResponse()
      return new Response('unexpected', { status: 500 })
    })

    const result = await generateImage(input, {
      env: { POLLINATIONS_API_KEY: 'sk_test' },
      fetch: fetchMock,
    })

    expect(result.provider).toBe('pollinations')
    const [url, init] = fetchMock.mock.calls[1]!
    expect(String(url)).toContain('https://image.pollinations.ai/prompt/')
    expect(init?.headers).toBeUndefined()
  })

  it('skips Google AI Studio and calls only the keyless legacy Pollinations endpoint when no keys are set', async () => {
    const fetchMock = vi.fn(async (...[url]: FetchArgs) => {
      if (String(url).includes('pollinations.ai')) return imageResponse()
      return new Response('unexpected', { status: 500 })
    })

    const result = await generateImage(input, { env: {}, fetch: fetchMock })

    expect(result.provider).toBe('pollinations')
    expect(calledUrls(fetchMock)).toHaveLength(1)
    expect(calledUrls(fetchMock)[0]).toContain('https://image.pollinations.ai/prompt/')
  })
})
