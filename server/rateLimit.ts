type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const WINDOW_MS = 24 * 60 * 60 * 1000
const LIMIT = Number(process.env.DAILY_LIMIT ?? 20)

export function rateLimit(ip: string): { ok: boolean; remaining: number } {
  const now = Date.now()
  const current = buckets.get(ip)
  if (!current || current.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { ok: true, remaining: LIMIT - 1 }
  }
  if (current.count >= LIMIT) return { ok: false, remaining: 0 }
  current.count += 1
  return { ok: true, remaining: LIMIT - current.count }
}
