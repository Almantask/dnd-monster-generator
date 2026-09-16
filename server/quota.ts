export type QuotaState = {
  exceeded: boolean
  exceededAt: number
  resetAt: number
}

// Default 60-second cooldown for Gemini rate limit (RPM window)
export const DEFAULT_GEMINI_COOLDOWN_MS = 60_000

let geminiQuotaState: QuotaState = {
  exceeded: false,
  exceededAt: 0,
  resetAt: 0,
}

export function isGeminiQuotaExceeded(now = Date.now()): boolean {
  if (!geminiQuotaState.exceeded) return false
  if (now >= geminiQuotaState.resetAt) {
    geminiQuotaState = { exceeded: false, exceededAt: 0, resetAt: 0 }
    return false
  }
  return true
}

export function markGeminiQuotaExceeded(
  cooldownMs = DEFAULT_GEMINI_COOLDOWN_MS,
  now = Date.now(),
): void {
  geminiQuotaState = {
    exceeded: true,
    exceededAt: now,
    resetAt: now + cooldownMs,
  }
}

export function clearGeminiQuota(): void {
  geminiQuotaState = { exceeded: false, exceededAt: 0, resetAt: 0 }
}

export function getGeminiQuotaStatus(now = Date.now()): {
  exceeded: boolean
  resetInMs: number
} {
  const exceeded = isGeminiQuotaExceeded(now)
  const resetInMs = exceeded ? Math.max(0, geminiQuotaState.resetAt - now) : 0
  return { exceeded, resetInMs }
}

export function isQuotaError(status?: number, errorText?: string): boolean {
  if (status === 429) return true
  if (status === 403 && errorText && /quota|resource_exhausted/i.test(errorText)) return true
  if (errorText && /429|quota|resource_exhausted|rate limit/i.test(errorText)) return true
  return false
}
