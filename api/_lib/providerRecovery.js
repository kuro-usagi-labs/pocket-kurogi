export function classifyProviderFailure({ status, retryAfterSeconds, dailyQuota = false, attempt = 0, random = Math.random } = {}) {
  if ([400, 401, 403, 404].includes(status)) return { reason: 'configuration', retryAfterMs: 86400000 }
  if (status === 429 && dailyQuota) return { reason: 'daily_quota', retryAfterMs: 86400000 }
  const hint = Number(retryAfterSeconds)
  const delay = Number.isFinite(hint) && hint > 0 ? hint * 1000
    : 1000 * 2 ** Math.min(6, Math.max(0, attempt)) * (1 + Math.max(0, Math.min(1, random())) * 0.25)
  return { reason: status === 429 ? 'rate_limit' : 'unavailable', retryAfterMs: Math.round(Math.min(60000, Math.max(1000, delay))) }
}
