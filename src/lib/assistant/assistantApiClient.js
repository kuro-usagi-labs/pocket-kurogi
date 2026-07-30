import { neon } from '../neon'
import { getAssistantJwt } from './assistantAuthToken'

async function fetchAssistantApi({
  endpoint,
  method,
  operation,
  body,
  token,
}) {
  return fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === 'POST'
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    ...(method === 'POST'
      ? {
          body: JSON.stringify({
            operation,
            ...body,
          }),
        }
      : {}),
  })
}

export async function requestAssistantApi({
  operation,
  method = 'POST',
  body = {},
} = {}) {
  const normalizedMethod = String(method || 'POST').toUpperCase()
  const endpoint = normalizedMethod === 'GET'
    ? `/api/assistant?operation=${encodeURIComponent(operation || 'get_state')}`
    : '/api/assistant'
  let token = await getAssistantJwt(neon.auth)
  let response = await fetchAssistantApi({
    endpoint,
    method: normalizedMethod,
    operation,
    body,
    token,
  })

  if (response.status === 401) {
    token = await getAssistantJwt(neon.auth, { forceRefresh: true })
    response = await fetchAssistantApi({
      endpoint,
      method: normalizedMethod,
      operation,
      body,
      token,
    })
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
      'Layanan assistant tidak dapat memproses request.'
    )
  }

  return payload?.data ?? null
}
