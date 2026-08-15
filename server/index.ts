import './env.ts'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { DIFFICULTIES, type Difficulty } from '../shared/taxonomies.ts'
import { generateStatblock } from './statblock.ts'
import { generateImage } from './image.ts'
import { rateLimit } from './rateLimit.ts'

const app = new Hono()
const origin = process.env.CORS_ORIGIN ?? '*'

app.use(
  '*',
  cors({
    origin,
    allowHeaders: ['Content-Type', 'X-Bestiary-Key'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  }),
)

app.get('/api/health', (c) => c.json({ ok: true }))

app.get('/api/status', (c) =>
  c.json({
    gemini: Boolean(process.env.GEMINI_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    pollinations: Boolean(process.env.POLLINATIONS_API_KEY),
    huggingface: Boolean(process.env.HF_TOKEN),
    passphraseRequired: Boolean(process.env.GENERATION_PASSPHRASE),
  }),
)

function clientIp(c: { req: { header: (name: string) => string | undefined } }) {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('cf-connecting-ip') ||
    'local'
  )
}

function authorize(c: { req: { header: (name: string) => string | undefined }; json: (d: unknown, s?: number) => Response }) {
  const expected = process.env.GENERATION_PASSPHRASE
  if (!expected) return null
  const provided = c.req.header('x-bestiary-key')
  if (provided !== expected) {
    return c.json({ error: 'Passphrase required' }, 401)
  }
  return null
}

app.post('/api/statblock', async (c) => {
  const denied = authorize(c)
  if (denied) return denied
  const limited = rateLimit(clientIp(c))
  if (!limited.ok) return c.json({ error: 'Daily conjuration limit reached' }, 429)
  const body = await c.req.json<{
    name?: string
    partySize?: number
    characterLevel?: number
    difficulty?: Difficulty
    description?: string
  }>()
  if (!body.name?.trim() || !body.description?.trim()) {
    return c.json({ error: 'Name and description are required' }, 400)
  }
  const partySize = Number(body.partySize)
  const characterLevel = Number(body.characterLevel)
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 10) {
    return c.json({ error: 'Party size must be 1-10' }, 400)
  }
  if (!Number.isInteger(characterLevel) || characterLevel < 1 || characterLevel > 20) {
    return c.json({ error: 'Character level must be 1-20' }, 400)
  }
  if (!body.difficulty || !DIFFICULTIES.includes(body.difficulty)) {
    return c.json({ error: 'Invalid difficulty' }, 400)
  }
  try {
    const result = await generateStatblock({
      name: body.name.trim(),
      partySize,
      characterLevel,
      difficulty: body.difficulty,
      description: body.description.trim(),
    })
    return c.json(result)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Statblock failed' }, 502)
  }
})

app.post('/api/image', async (c) => {
  const denied = authorize(c)
  if (denied) return denied
  const limited = rateLimit(`${clientIp(c)}-image`)
  if (!limited.ok) return c.json({ error: 'Daily conjuration limit reached' }, 429)
  const body = await c.req.json<{
    name?: string
    description?: string
    type?: string
    size?: string
  }>()
  if (!body.name?.trim()) return c.json({ error: 'Name is required' }, 400)
  try {
    const result = await generateImage({
      name: body.name.trim(),
      description: body.description?.trim() || body.name,
      type: body.type?.trim() || 'creature',
      size: body.size?.trim() || 'Medium',
    })
    return c.json(result)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Image failed' }, 502)
  }
})

const port = Number(process.env.PORT ?? 8080)
serve({ fetch: app.fetch, port }, () => {
  console.log(`Bestiary API on ${port}`)
})
