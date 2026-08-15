export const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image'

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

async function fromGemini(
  prompt: string,
  runtime?: ImageRuntime,
): Promise<{ mime: string; bytes: Uint8Array }> {
  const key = envOf(runtime).GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  const res = await fetchOf(runtime)(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`,
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
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`)
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
    return { mime, bytes }
  }
  throw new Error('Gemini did not return an image')
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
  for (const url of urls) {
    try {
      const res = await fetchOf(runtime)(url, {
        headers: key ? { Authorization: `Bearer ${key}` } : undefined,
      })
      if (!res.ok) {
        last = `Pollinations ${res.status}`
        continue
      }
      const mime = res.headers.get('content-type') || 'image/jpeg'
      if (!mime.startsWith('image/')) {
        last = 'Pollinations did not return an image'
        continue
      }
      const bytes = new Uint8Array(await res.arrayBuffer())
      if (bytes.byteLength < 1000) {
        last = 'Pollinations image too small'
        continue
      }
      return { mime, bytes }
    } catch (error) {
      last = error instanceof Error ? error.message : String(error)
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
  for (const url of endpoints) {
    const res = await fetchOf(runtime)(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt }),
    })
    if (!res.ok) {
      last = `Hugging Face ${res.status}: ${(await res.text()).slice(0, 200)}`
      continue
    }
    const mime = res.headers.get('content-type') || 'image/png'
    const bytes = new Uint8Array(await res.arrayBuffer())
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
  const errors: string[] = []
  const env = envOf(runtime)

  if (env.GEMINI_API_KEY) {
    try {
      const image = await fromGemini(prompt, runtime)
      return { mime: image.mime, dataUrl: toDataUrl(image.mime, image.bytes), provider: 'gemini' }
    } catch (error) {
      errors.push(`Gemini: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  try {
    const image = await fromPollinations(prompt, runtime)
    return { mime: image.mime, dataUrl: toDataUrl(image.mime, image.bytes), provider: 'pollinations' }
  } catch (error) {
    errors.push(`Pollinations: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (env.HF_TOKEN) {
    try {
      const image = await fromHuggingFace(prompt, runtime)
      return { mime: image.mime, dataUrl: toDataUrl(image.mime, image.bytes), provider: 'huggingface' }
    } catch (error) {
      errors.push(`Hugging Face: ${error instanceof Error ? error.message : String(error)}`)
    }
  } else {
    errors.push('Hugging Face: HF_TOKEN is not set')
  }

  throw new Error(`Image generation failed. ${errors.join('. ')}`)
}
