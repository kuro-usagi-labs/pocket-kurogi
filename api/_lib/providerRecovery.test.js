import { it, expect } from 'vitest'
import { classifyProviderFailure } from './providerRecovery.js'
it('honors bounded provider retry guidance without inferring daily quota', () => {
  expect(classifyProviderFailure({ status: 429, retryAfterSeconds: 20, random: () => 0 }).retryAfterMs).toBe(20000)
  expect(classifyProviderFailure({ status: 429, random: () => 0 }).retryAfterMs).toBe(1000)
  expect(classifyProviderFailure({ status: 429, dailyQuota: true }).reason).toBe('daily_quota')
})
it.each([NaN, -1, Infinity, 'oops'])('rejects invalid retry hints %s', retryAfterSeconds => {
  expect(classifyProviderFailure({ status: 503, retryAfterSeconds, random: () => 0 }).retryAfterMs).toBe(1000)
})
it('caps exponential retry and separates configuration failure', () => {
  expect(classifyProviderFailure({ status: 503, attempt: 99 }).retryAfterMs).toBeLessThanOrEqual(60000)
  expect(classifyProviderFailure({ status: 429, retryAfterSeconds: 999999 }).retryAfterMs).toBe(60000)
  expect(classifyProviderFailure({ status: 403 }).reason).toBe('configuration')
})
