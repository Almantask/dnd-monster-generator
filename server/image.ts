import { CLOUDFLARE_IMAGE_MODELS, GEMINI_IMAGE_MODELS, IMAGEN_MODELS } from '../shared/aiModels.ts'
import { isFreeTierZeroQuota } from './quota.ts'

export const FREE_TIER_IMAGE_MESSAGE =
  'GEMINI_API_KEY belongs to a free-tier Google AI Studio project, which has no image generation quota (limit 0). Enable billing for that project in Google AI Studio to generate portraits with Gemini.'

export const CLOUDFLARE_DAILY_LIMIT_MESSAGE =
  'Cloudflare Workers AI daily free allocation (10,000 neurons) is used up; it resets daily.'

class GoogleImageError extends Error {
  constructor(
    message: string,
    readonly needsBilling: boolean,
  ) {
    super(message)
  }
}

class CloudflareImageError extends Error {
  constructor(
    message: string,
    /** Bad token or exhausted neuron pool: every Workers AI model would fail the same way. */
    readonly affectsAllModels: boolean,
  ) {
    super(message)
  }
}

export type ImageRuntime = {
  env?: NodeJS.Dict<string>
  fetch?: typeof globalThis.fetch
}

function promptFor(input: { name: string; description: string; type: string; size: string }) {
  return `Fantasy Dungeons and Dragons bestiary illustration, painted parchment style, of ${input.size} ${input.type} named ${input.name}. ${input.description}. Full body creature portrait, dramatic lighting, no text, no watermark, no UI.`
}

function envOf(runtime?: ImageRuntime) {
  return runtime?.env ?? process.env
}

function fetchOf(runtime?: ImageRuntime) {
  return runtime?.fetch ?? globalThis.fetch
}

async function fromImagen(
  model: string,
  prompt: string,
  runtime?: ImageRuntime,
): Promise<{ mime: string; bytes: Uint8Array }> {
  const key = envOf(runtime).GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  console.log(`[IMAGEN] Calling Google AI Studio for image with model "${model}"...`)
  const start = Date.now()
  const res = await fetchOf(runtime)(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '3:4',
          outputOptions: { mimeType: 'image/png' },
        },
      }),
      signal: AbortSignal.timeout(90_000),
    },
  )
  const duration = Date.now() - start
  if (!res.ok) {
    const errText = await res.text()
    console.warn(`[IMAGEN] ✗ Imagen model "${model}" failed (${res.status}) in ${duration}ms: ${errText.slice(0, 300)}`)
    throw new GoogleImageError(
      `Imagen ${model} (${res.status}): ${errText.slice(0, 200)}`,
      isFreeTierZeroQuota(res.status, errText),
    )
  }
  const data = (await res.json()) as {
    predictions?: Array<{
      bytesBase64Encoded?: string
      mimeType?: string
    }>
  }
  const prediction = data.predictions?.[0]
  if (!prediction?.bytesBase64Encoded) {
    console.warn(`[IMAGEN] ✗ Imagen model "${model}" returned no prediction in ${duration}ms`)
    throw new Error(`Imagen ${model} returned no image prediction`)
  }
  const mime = prediction.mimeType || 'image/png'
  const bytes = Uint8Array.from(Buffer.from(prediction.bytesBase64Encoded, 'base64'))
  if (!bytes.byteLength) throw new Error('Imagen image empty')
  console.log(`[IMAGEN] ✓ Image received from "${model}" (${bytes.byteLength} bytes, ${mime}) in ${duration}ms`)
  return { mime, bytes }
}

async function fromGeminiMultimodal(
  model: string,
  prompt: string,
  runtime?: ImageRuntime,
): Promise<{ mime: string; bytes: Uint8Array }> {
  const key = envOf(runtime).GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  console.log(`[GEMINI] Calling Google AI Studio multimodal image generation with model "${model}"...`)
  const start = Date.now()
  const res = await fetchOf(runtime)(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio: '3:4' },
        },
      }),
      signal: AbortSignal.timeout(90_000),
    },
  )
  const duration = Date.now() - start
  if (!res.ok) {
    const errText = await res.text()
    console.warn(`[GEMINI] ✗ Gemini multimodal image API failed (${res.status}) in ${duration}ms: ${errText.slice(0, 300)}`)
    throw new GoogleImageError(
      `Gemini ${model} (${res.status}): ${errText.slice(0, 200)}`,
      isFreeTierZeroQuota(res.status, errText),
    )
  }
  const data = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType?: string; data?: string }
          inline_data?: { mime_type?: string; data?: string }
        }>
      }
    }>
  }
  for (const part of data.candidates?.[0]?.content?.parts ?? []) {
    const inline = part.inlineData ?? part.inline_data
    if (!inline?.data) continue
    const mime = inline.mimeType ?? inline.mime_type ?? 'image/png'
    const bytes = Uint8Array.from(Buffer.from(inline.data, 'base64'))
    if (!bytes.byteLength) throw new Error('Gemini image empty')
    console.log(`[GEMINI] ✓ Image received (${bytes.byteLength} bytes, ${mime}) in ${duration}ms`)
    return { mime, bytes }
  }
  console.warn(`[GEMINI] ✗ Gemini did not return inline image data in ${duration}ms`)
  throw new Error('Gemini did not return an image')
}

async function fromGoogleStudio(
  prompt: string,
  runtime?: ImageRuntime,
): Promise<{ mime: string; bytes: Uint8Array; provider: 'imagen' | 'gemini' }> {
  const env = envOf(runtime)
  const userModel = env.IMAGEN_MODEL?.trim() || env.GEMINI_IMAGE_MODEL?.trim()
  const candidateModels = [
    ...(userModel ? [userModel] : []),
    ...GEMINI_IMAGE_MODELS,
    ...IMAGEN_MODELS,
  ].filter((m, idx, arr) => arr.indexOf(m) === idx)

  let lastError = 'All Google AI Studio image models failed'
  for (const model of candidateModels) {
    try {
      if (model.includes('imagen')) {
        const image = await fromImagen(model, prompt, runtime)
        return { ...image, provider: 'imagen' }
      } else {
        const image = await fromGeminiMultimodal(model, prompt, runtime)
        return { ...image, provider: 'gemini' }
      }
    } catch (err) {
      if (err instanceof GoogleImageError && err.needsBilling) {
        // Every image model shares this project-level limit, so trying the rest only burns time.
        console.warn(`[GOOGLE AI STUDIO] ✗ ${FREE_TIER_IMAGE_MESSAGE}`)
        throw new Error(FREE_TIER_IMAGE_MESSAGE)
      }
      lastError = err instanceof Error ? err.message : String(err)
      console.warn(`[GOOGLE AI STUDIO] Model "${model}" failed: ${lastError}`)
    }
  }
  throw new Error(lastError)
}

function sniffImageMime(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (Buffer.from(bytes.subarray(8, 12)).toString('ascii') === 'WEBP') return 'image/webp'
  return 'image/jpeg'
}

async function fromCloudflareModel(
  model: string,
  prompt: string,
  runtime?: ImageRuntime,
): Promise<{ mime: string; bytes: Uint8Array }> {
  const env = envOf(runtime)
  const headers: Record<string, string> = { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` }
  let body: FormData | string
  if (model.includes('flux-2')) {
    // FLUX.2 models on Workers AI only accept multipart input; fetch sets the boundary header.
    body = new FormData()
    body.append('prompt', prompt)
    body.append('width', '768')
    body.append('height', '1024')
  } else {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify({ prompt, steps: 4 })
  }
  console.log(`[CLOUDFLARE] Calling Workers AI for image with model "${model}"...`)
  const start = Date.now()
  const res = await fetchOf(runtime)(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`,
    // FLUX.2 klein measured 18-31s per portrait; schnell answers in ~2s.
    { method: 'POST', headers, body, signal: AbortSignal.timeout(60_000) },
  )
  const duration = Date.now() - start
  if (!res.ok) {
    const errText = await res.text()
    console.warn(`[CLOUDFLARE] ✗ Model "${model}" failed (${res.status}) in ${duration}ms: ${errText.slice(0, 300)}`)
    if (/daily free allocation|"code"\s*:\s*4006\b/i.test(errText)) {
      throw new CloudflareImageError(CLOUDFLARE_DAILY_LIMIT_MESSAGE, true)
    }
    throw new CloudflareImageError(
      `Workers AI ${model} (${res.status}): ${errText.slice(0, 200)}`,
      [401, 403, 429].includes(res.status),
    )
  }
  const data = (await res.json()) as { result?: { image?: string }; image?: string }
  const b64 = data.result?.image ?? data.image
  if (!b64) {
    console.warn(`[CLOUDFLARE] ✗ Model "${model}" returned no image in ${duration}ms`)
    throw new CloudflareImageError(`Workers AI ${model} returned no image`, false)
  }
  const bytes = Uint8Array.from(Buffer.from(b64, 'base64'))
  if (!bytes.byteLength) throw new CloudflareImageError(`Workers AI ${model} image empty`, false)
  const mime = sniffImageMime(bytes)
  console.log(`[CLOUDFLARE] ✓ Image received from "${model}" (${bytes.byteLength} bytes, ${mime}) in ${duration}ms`)
  return { mime, bytes }
}

async function fromCloudflare(
  prompt: string,
  runtime?: ImageRuntime,
): Promise<{ mime: string; bytes: Uint8Array }> {
  const userModel = envOf(runtime).CLOUDFLARE_IMAGE_MODEL?.trim()
  const candidateModels = [
    ...(userModel ? [userModel] : []),
    ...CLOUDFLARE_IMAGE_MODELS,
  ].filter((m, idx, arr) => arr.indexOf(m) === idx)

  let lastError = 'All Cloudflare Workers AI image models failed'
  for (const model of candidateModels) {
    try {
      return await fromCloudflareModel(model, prompt, runtime)
    } catch (err) {
      if (err instanceof CloudflareImageError && err.affectsAllModels) throw err
      lastError = err instanceof Error ? err.message : String(err)
      console.warn(`[CLOUDFLARE] Model "${model}" failed: ${lastError}`)
    }
  }
  throw new Error(lastError)
}

async function fromPollinations(
  prompt: string,
  runtime?: ImageRuntime,
): Promise<{ mime: string; bytes: Uint8Array }> {
  const encoded = encodeURIComponent(prompt)
  const key = envOf(runtime).POLLINATIONS_API_KEY?.trim()
  const query = 'model=flux&width=768&height=1024&nologo=true'
  const endpoints: Array<{ url: string; headers?: Record<string, string> }> = [
    // gen.pollinations.ai rejects keyless requests (401), so only call it with a secret key.
    ...(key
      ? [{ url: `https://gen.pollinations.ai/image/${encoded}?${query}`, headers: { Authorization: `Bearer ${key}` } }]
      : []),
    // Legacy keyless endpoint; never send the secret key here.
    { url: `https://image.pollinations.ai/prompt/${encoded}?${query}` },
  ]
  let last = 'Pollinations failed'
  for (let i = 0; i < endpoints.length; i++) {
    const { url, headers } = endpoints[i]!
    console.log(`[POLLINATIONS] Attempting endpoint ${i + 1}/${endpoints.length}...`)
    const start = Date.now()
    try {
      const res = await fetchOf(runtime)(url, { headers })
      const duration = Date.now() - start
      if (!res.ok) {
        last = `Pollinations ${res.status}`
        console.warn(`[POLLINATIONS] Endpoint ${i + 1} returned status ${res.status} in ${duration}ms`)
        continue
      }
      const mime = res.headers.get('content-type') || 'image/jpeg'
      if (!mime.startsWith('image/')) {
        last = 'Pollinations did not return an image'
        console.warn(`[POLLINATIONS] Expected image content-type, got: ${mime}`)
        continue
      }
      const bytes = new Uint8Array(await res.arrayBuffer())
      if (bytes.byteLength < 1000) {
        last = 'Pollinations image too small'
        console.warn(`[POLLINATIONS] Image too small (${bytes.byteLength} bytes)`)
        continue
      }
      console.log(`[POLLINATIONS] ✓ Image received (${bytes.byteLength} bytes, ${mime}) in ${duration}ms`)
      return { mime, bytes }
    } catch (error) {
      last = error instanceof Error ? error.message : String(error)
      console.warn(`[POLLINATIONS] Endpoint ${i + 1} fetch error: ${last}`)
    }
  }
  throw new Error(last)
}

function toDataUrl(mime: string, bytes: Uint8Array): string {
  const b64 = Buffer.from(bytes).toString('base64')
  return `data:${mime};base64,${b64}`
}

export async function generateImage(
  input: {
    name: string
    description: string
    type: string
    size: string
  },
  runtime?: ImageRuntime,
) {
  const prompt = promptFor(input)
  console.log(`[IMAGE] Formulated prompt: "${prompt.slice(0, 150)}..."`)
  const errors: string[] = []
  const env = envOf(runtime)

  if (env.GEMINI_API_KEY) {
    console.log('[IMAGE] Provider 1/3: Attempting Google AI Studio (Imagen / Gemini)...')
    try {
      const image = await fromGoogleStudio(prompt, runtime)
      return { mime: image.mime, dataUrl: toDataUrl(image.mime, image.bytes), provider: image.provider }
    } catch (error) {
      const msg = `Google AI Studio: ${error instanceof Error ? error.message : String(error)}`
      console.warn(`[IMAGE] ${msg}`)
      errors.push(msg)
    }
  } else {
    console.log('[IMAGE] Provider 1/3: Skipping Google AI Studio (GEMINI_API_KEY not set)')
  }

  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
    console.log('[IMAGE] Provider 2/3: Attempting Cloudflare Workers AI (FLUX)...')
    try {
      const image = await fromCloudflare(prompt, runtime)
      return { mime: image.mime, dataUrl: toDataUrl(image.mime, image.bytes), provider: 'cloudflare' }
    } catch (error) {
      const msg = `Cloudflare Workers AI: ${error instanceof Error ? error.message : String(error)}`
      console.warn(`[IMAGE] ${msg}`)
      errors.push(msg)
    }
  } else {
    console.log('[IMAGE] Provider 2/3: Skipping Cloudflare Workers AI (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN not set)')
  }

  console.log('[IMAGE] Provider 3/3: Attempting Pollinations (FLUX)...')
  try {
    const image = await fromPollinations(prompt, runtime)
    return { mime: image.mime, dataUrl: toDataUrl(image.mime, image.bytes), provider: 'pollinations' }
  } catch (error) {
    const msg = `Pollinations: ${error instanceof Error ? error.message : String(error)}`
    console.warn(`[IMAGE] ${msg}`)
    errors.push(msg)
  }

  throw new Error(`Image generation failed. ${errors.join('. ')}`)
}
