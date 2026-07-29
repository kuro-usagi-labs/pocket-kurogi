import { neon } from '../neon'

export async function requestAssistantApi({
  operation,
  method = 'POST',
  body = {},
} = {}) {
  const tokenResult = await neon.auth.token()
  const token = tokenResult?.data?.token || tokenResult?.token || null
  if (tokenResult?.error || !token) {
    throw new Error('Sesi autentikasi assistant tidak tersedia. Silakan login ulang.')
  }

  const normalizedMethod = String(method || 'POST').toUpperCase()
  const endpoint = normalizedMethod === 'GET'
    ? `/api/assistant?operation=${encodeURIComponent(operation || 'get_state')}`
    : '/api/assistant'
  const response = await fetch(endpoint, {
    method: normalizedMethod,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(normalizedMethod === 'POST'
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    ...(normalizedMethod === 'POST'
      ? {
          body: JSON.stringify({
            operation,
            ...body,
          }),
        }
      : {}),
  })
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
      'Layanan assistant tidak dapat memproses request.'
    )
  }

  return payload?.data ?? null
}
