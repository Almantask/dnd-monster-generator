import './env.ts'
import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { DIFFICULTIES, type Difficulty } from '../shared/taxonomies.ts'
import { generateStatblock } from './statblock.ts'
import { generateImage } from './image.ts'
import { rateLimit } from './rateLimit.ts'
import { getGeminiQuotaStatus } from './quota.ts'

const app = new Hono()
const origin = process.env.CORS_ORIGIN ?? '*'

app.use('*', logger())
app.use(
  '*',
  cors({
    origin,
    allowHeaders: ['Content-Type', 'X-Bestiary-Key'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  }),
)

app.get('/api/health', (c) => {
  console.log('[API] GET /api/health - ok')
  return c.json({ ok: true })
})

app.get('/api/status', (c) => {
  const quota = getGeminiQuotaStatus()
  const status = {
    gemini: Boolean(process.env.GEMINI_API_KEY),
    geminiQuotaExceeded: quota.exceeded,
    geminiQuotaResetInMs: quota.resetInMs,
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    cloudflare: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),
    pollinations: Boolean(process.env.POLLINATIONS_API_KEY),
    passphraseRequired: Boolean(process.env.GENERATION_PASSPHRASE),
  }
  console.log('[API] GET /api/status - Providers configured:', status)
  return c.json(status)
})

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
    console.warn(`[AUTH] Unauthorized request from ${clientIp(c)}: missing or invalid passphrase`)
    return c.json({ error: 'Passphrase required' }, 401)
  }
  return null
}

app.post('/api/statblock', async (c) => {
  const ip = clientIp(c)
  console.log(`\n--- [API] POST /api/statblock from ${ip} ---`)
  const denied = authorize(c)
  if (denied) return denied
  const limited = rateLimit(ip)
  if (!limited.ok) {
    console.warn(`[RATE LIMIT] Rate limit exceeded for IP: ${ip}`)
    return c.json({ error: 'Daily conjuration limit reached' }, 429)
  }
  const body = await c.req.json<{
    name?: string
    partySize?: number
    characterLevel?: number
    difficulty?: Difficulty
    description?: string
  }>()
  console.log(`[STATBLOCK] Request: name="${body.name}", partySize=${body.partySize}, level=${body.characterLevel}, difficulty=${body.difficulty}`)
  if (!body.name?.trim() || !body.description?.trim()) {
    console.warn('[STATBLOCK] 400 Bad Request: Name and description are required')
    return c.json({ error: 'Name and description are required' }, 400)
  }
  const partySize = Number(body.partySize)
  const characterLevel = Number(body.characterLevel)
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 10) {
    console.warn(`[STATBLOCK] 400 Bad Request: Invalid party size: ${partySize}`)
    return c.json({ error: 'Party size must be 1-10' }, 400)
  }
  if (!Number.isInteger(characterLevel) || characterLevel < 1 || characterLevel > 20) {
    console.warn(`[STATBLOCK] 400 Bad Request: Invalid character level: ${characterLevel}`)
    return c.json({ error: 'Character level must be 1-20' }, 400)
  }
  if (!body.difficulty || !DIFFICULTIES.includes(body.difficulty)) {
    console.warn(`[STATBLOCK] 400 Bad Request: Invalid difficulty: ${body.difficulty}`)
    return c.json({ error: 'Invalid difficulty' }, 400)
  }
  try {
    const start = Date.now()
    const result = await generateStatblock({
      name: body.name.trim(),
      partySize,
      characterLevel,
      difficulty: body.difficulty,
      description: body.description.trim(),
    })
    console.log(`[STATBLOCK] ✓ Successfully completed in ${Date.now() - start}ms (model: ${result.model})`)
    return c.json(result)
  } catch (error) {
    console.error(`[STATBLOCK] ✗ Failed:`, error instanceof Error ? error.message : error)
    return c.json({ error: error instanceof Error ? error.message : 'Statblock failed' }, 502)
  }
})

app.post('/api/image', async (c) => {
  const ip = clientIp(c)
  console.log(`\n--- [API] POST /api/image from ${ip} ---`)
  const denied = authorize(c)
  if (denied) return denied
  const limited = rateLimit(`${ip}-image`)
  if (!limited.ok) {
    console.warn(`[RATE LIMIT] Image rate limit exceeded for IP: ${ip}`)
    return c.json({ error: 'Daily conjuration limit reached' }, 429)
  }
  const body = await c.req.json<{
    name?: string
    description?: string
    type?: string
    size?: string
  }>()
  console.log(`[IMAGE] Request: name="${body.name}", type="${body.type}", size="${body.size}"`)
  if (!body.name?.trim()) {
    console.warn('[IMAGE] 400 Bad Request: Name is required')
    return c.json({ error: 'Name is required' }, 400)
  }
  try {
    const start = Date.now()
    const result = await generateImage({
      name: body.name.trim(),
      description: body.description?.trim() || body.name,
      type: body.type?.trim() || 'creature',
      size: body.size?.trim() || 'Medium',
    })
    console.log(`[IMAGE] ✓ Successfully generated portrait via ${result.provider} in ${Date.now() - start}ms`)
    return c.json(result)
  } catch (error) {
    console.error(`[IMAGE] ✗ Failed:`, error instanceof Error ? error.message : error)
    return c.json({ error: error instanceof Error ? error.message : 'Image failed' }, 502)
  }
})

if (existsSync('./dist')) {
  app.use('/*', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))
}

const port = Number(process.env.PORT ?? 8080)
serve({ fetch: app.fetch, port }, () => {
  console.log(`\n==============================================`)
  console.log(`  🐉 The Bestiary API Server`)
  console.log(`  Port: http://localhost:${port}`)
  console.log(`  - GEMINI_API_KEY:       ${process.env.GEMINI_API_KEY ? '✓ Set' : '✗ Not set'}`)
  console.log(`  - OPENROUTER_API_KEY:   ${process.env.OPENROUTER_API_KEY ? '✓ Set' : '✗ Not set'}`)
  console.log(`  - CLOUDFLARE (Workers AI): ${process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN ? '✓ Set' : '✗ Not set (needs CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN)'}`)
  console.log(`  - POLLINATIONS_API_KEY: ${process.env.POLLINATIONS_API_KEY ? '✓ Set' : '✗ Not set (anonymous legacy endpoint)'}`)
  console.log(`  - PASSPHRASE:           ${process.env.GENERATION_PASSPHRASE ? '✓ Required' : '✗ None (open)'}`)
  console.log(`==============================================\n`)
})

