import { IMAGEN_MODELS } from '../shared/aiModels.ts'
import { isQuotaError, markGeminiQuotaExceeded } from './quota.ts'

export const DEFAULT_IMAGEN_MODEL = 'imagen-3.0-generate-002'

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
    const errText = (await res.text()).slice(0, 300)
    console.warn(`[IMAGEN] ✗ Imagen model "${model}" failed (${res.status}) in ${duration}ms: ${errText}`)
    throw new Error(`Imagen ${model} (${res.status}): ${errText.slice(0, 200)}`)
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
    const errText = (await res.text()).slice(0, 300)
    console.warn(`[GEMINI] ✗ Gemini multimodal image API failed (${res.status}) in ${duration}ms: ${errText}`)
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`)
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
      lastError = err instanceof Error ? err.message : String(err)
      console.warn(`[GOOGLE AI STUDIO] Model "${model}" failed: ${lastError}`)
    }
  }

  // Final fallback to multimodal gemini-2.5-flash-image if all Imagen models failed
  try {
    const image = await fromGeminiMultimodal('gemini-2.5-flash-image', prompt, runtime)
    return { ...image, provider: 'gemini' }
  } catch {
    throw new Error(lastError)
  }
}

async function fromPollinations(
  prompt: string,
  runtime?: ImageRuntime,
): Promise<{ mime: string; bytes: Uint8Array }> {
  const encoded = encodeURIComponent(prompt)
  const key = envOf(runtime).POLLINATIONS_API_KEY
  const urls = [
    `https://gen.pollinations.ai/image/${encoded}?model=flux&width=768&height=1024&nologo=true`,
    `https://image.pollinations.ai/prompt/${encoded}?model=flux&width=768&height=1024&nologo=true`,
  ]
  let last = 'Pollinations failed'
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!
    console.log(`[POLLINATIONS] Attempting endpoint ${i + 1}/${urls.length}...`)
    const start = Date.now()
    try {
      const res = await fetchOf(runtime)(url, {
        headers: key ? { Authorization: `Bearer ${key}` } : undefined,
      })
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

async function fromHuggingFace(
  prompt: string,
  runtime?: ImageRuntime,
): Promise<{ mime: string; bytes: Uint8Array }> {
  const token = envOf(runtime).HF_TOKEN
  if (!token) throw new Error('HF_TOKEN is not set')
  const endpoints = [
    'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
    'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
  ]
  let last = 'Hugging Face failed'
  for (let i = 0; i < endpoints.length; i++) {
    const url = endpoints[i]!
    console.log(`[HUGGINGFACE] Calling HuggingFace endpoint ${i + 1}/${endpoints.length}...`)
    const start = Date.now()
    const res = await fetchOf(runtime)(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt }),
    })
    const duration = Date.now() - start
    if (!res.ok) {
      const errText = (await res.text()).slice(0, 300)
      last = `Hugging Face ${res.status}: ${errText}`
      console.warn(`[HUGGINGFACE] Endpoint ${i + 1} failed (${res.status}) in ${duration}ms: ${errText}`)
      continue
    }
    const mime = res.headers.get('content-type') || 'image/png'
    const bytes = new Uint8Array(await res.arrayBuffer())
    console.log(`[HUGGINGFACE] ✓ Image received (${bytes.byteLength} bytes, ${mime}) in ${duration}ms`)
    return { mime, bytes }
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
      if (isQuotaError(undefined, msg)) {
        markGeminiQuotaExceeded()
      }
    }
  } else {
    console.log('[IMAGE] Provider 1/3: Skipping Google AI Studio (GEMINI_API_KEY not set)')
  }

  console.log('[IMAGE] Provider 2/3: Attempting Pollinations (FLUX)...')
  try {
    const image = await fromPollinations(prompt, runtime)
    return { mime: image.mime, dataUrl: toDataUrl(image.mime, image.bytes), provider: 'pollinations' }
  } catch (error) {
    const msg = `Pollinations: ${error instanceof Error ? error.message : String(error)}`
    console.warn(`[IMAGE] ${msg}`)
    errors.push(msg)
  }

  if (env.HF_TOKEN) {
    console.log('[IMAGE] Provider 3/3: Attempting Hugging Face...')
    try {
      const image = await fromHuggingFace(prompt, runtime)
      return { mime: image.mime, dataUrl: toDataUrl(image.mime, image.bytes), provider: 'huggingface' }
    } catch (error) {
      const msg = `Hugging Face: ${error instanceof Error ? error.message : String(error)}`
      console.warn(`[IMAGE] ${msg}`)
      errors.push(msg)
    }
  } else {
    console.log('[IMAGE] Provider 3/3: Skipping Hugging Face (HF_TOKEN not set)')
    errors.push('Hugging Face: HF_TOKEN is not set')
  }

  throw new Error(`Image generation failed. ${errors.join('. ')}`)
}
