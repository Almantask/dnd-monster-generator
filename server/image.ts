function promptFor(input: { name: string; description: string; type: string; size: string }) {
  return `Fantasy Dungeons and Dragons bestiary illustration, painted parchment style, of ${input.size} ${input.type} named ${input.name}. ${input.description}. Full body creature portrait, dramatic lighting, no text, no watermark, no UI.`
}

async function fromPollinations(prompt: string): Promise<{ mime: string; bytes: Uint8Array }> {
  const encoded = encodeURIComponent(prompt)
  const key = process.env.POLLINATIONS_API_KEY
  const urls = [
    `https://gen.pollinations.ai/image/${encoded}?model=flux&width=768&height=1024&nologo=true`,
    `https://image.pollinations.ai/prompt/${encoded}?model=flux&width=768&height=1024&nologo=true`,
  ]
  let last = 'Pollinations failed'
  for (const url of urls) {
    try {
      const res = await fetch(url, {
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

async function fromHuggingFace(prompt: string): Promise<{ mime: string; bytes: Uint8Array }> {
  const token = process.env.HF_TOKEN
  if (!token) throw new Error('HF_TOKEN is not set')
  const endpoints = [
    'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
    'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
  ]
  let last = 'Hugging Face failed'
  for (const url of endpoints) {
    const res = await fetch(url, {
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

export async function generateImage(input: {
  name: string
  description: string
  type: string
  size: string
}) {
  const prompt = promptFor(input)
  try {
    const image = await fromPollinations(prompt)
    return { mime: image.mime, dataUrl: toDataUrl(image.mime, image.bytes), provider: 'pollinations' }
  } catch (pollinationsError) {
    try {
      const image = await fromHuggingFace(prompt)
      return { mime: image.mime, dataUrl: toDataUrl(image.mime, image.bytes), provider: 'huggingface' }
    } catch (hfError) {
      const a = pollinationsError instanceof Error ? pollinationsError.message : String(pollinationsError)
      const b = hfError instanceof Error ? hfError.message : String(hfError)
      throw new Error(`Image generation failed. Pollinations: ${a}. Hugging Face: ${b}`)
    }
  }
}
