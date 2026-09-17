import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearGeminiQuota,
  getGeminiQuotaStatus,
  isFreeTierZeroQuota,
  isGeminiQuotaExceeded,
  isQuotaError,
  markGeminiQuotaExceeded,
} from './quota.ts'

describe('server/quota', () => {
  beforeEach(() => {
    clearGeminiQuota()
  })

  it('reports not exceeded by default', () => {
    expect(isGeminiQuotaExceeded()).toBe(false)
    const status = getGeminiQuotaStatus()
    expect(status.exceeded).toBe(false)
    expect(status.resetInMs).toBe(0)
  })

  it('marks quota as exceeded with a cooldown duration', () => {
    const baseTime = 100_000
    markGeminiQuotaExceeded(60_000, baseTime)

    expect(isGeminiQuotaExceeded(baseTime + 30_000)).toBe(true)
    const status = getGeminiQuotaStatus(baseTime + 30_000)
    expect(status.exceeded).toBe(true)
    expect(status.resetInMs).toBe(30_000)

    // After cooldown expires
    expect(isGeminiQuotaExceeded(baseTime + 60_000)).toBe(false)
    const statusAfter = getGeminiQuotaStatus(baseTime + 60_000)
    expect(statusAfter.exceeded).toBe(false)
    expect(statusAfter.resetInMs).toBe(0)
  })

  it('clears quota on manual clear', () => {
    markGeminiQuotaExceeded(60_000)
    expect(isGeminiQuotaExceeded()).toBe(true)
    clearGeminiQuota()
    expect(isGeminiQuotaExceeded()).toBe(false)
  })

  it('identifies quota errors from status code or message', () => {
    expect(isQuotaError(429)).toBe(true)
    expect(isQuotaError(403, 'RESOURCE_EXHAUSTED: quota exceeded')).toBe(true)
    expect(isQuotaError(500, 'Gemini failed (429): Quota exceeded')).toBe(true)
    expect(isQuotaError(500, 'Some other network failure')).toBe(false)
  })

  it('identifies free-tier limit-0 quota errors that need billing rather than a cooldown', () => {
    const zeroLimit =
      '* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-3.1-flash-image'
    const dailyLimit =
      '* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.5-flash'
    expect(isFreeTierZeroQuota(429, zeroLimit)).toBe(true)
    expect(isFreeTierZeroQuota(429, dailyLimit)).toBe(false)
    expect(isFreeTierZeroQuota(404, zeroLimit)).toBe(false)
  })
})
