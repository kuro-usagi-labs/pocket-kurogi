import { neon } from '../neon'
import { getAssistantJwt } from '../assistant/assistantAuthToken'

function createRequestId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
}

function toChatError(payload, status) {
  const error = new Error(
    payload?.error?.message || 'Riwayat percakapan belum dapat disinkronkan.'
  )
  error.code = payload?.error?.code || `CHAT_HTTP_${status}`
  error.status = status
  return error
}

async function sendRequest({ endpoint, method, body, token, requestId, sessionGeneration, retryAttempt }) {
  return fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Request-Id': requestId,
      'X-Chat-Session-Generation': String(sessionGeneration || 0),
      'X-Chat-Retry-Attempt': String(retryAttempt || 0),
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  })
}

/**
 * Chat persistence has its own server endpoint so history reads and writes
 * share authentication refresh, request correlation, and safe diagnostics.
 */
export async function requestChatApi({
  operation,
  method = 'POST',
  body = {},
  sessionGeneration = 0,
  retryAttempt = 0,
} = {}) {
  const normalizedMethod = String(method).toUpperCase()
  const query = normalizedMethod === 'GET'
    ? new URLSearchParams({ operation, ...body }).toString()
    : ''
  const endpoint = normalizedMethod === 'GET' ? `/api/chat?${query}` : '/api/chat'
  const requestId = createRequestId()
  let token = await getAssistantJwt(neon.auth)
  let response = await sendRequest({
    endpoint,
    method: normalizedMethod,
    body: { operation, ...body },
    token,
    requestId,
    sessionGeneration,
    retryAttempt,
  })

  if (response.status === 401) {
    token = await getAssistantJwt(neon.auth, { forceRefresh: true })
    response = await sendRequest({
      endpoint,
      method: normalizedMethod,
      body: { operation, ...body },
      token,
      requestId,
      sessionGeneration,
      retryAttempt: Number(retryAttempt || 0) + 1,
    })
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok) throw toChatError(payload, response.status)

  return {
    data: payload?.data ?? null,
    requestId: payload?.meta?.requestId || requestId,
  }
}
