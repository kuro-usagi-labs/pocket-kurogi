const FORCE_FETCH_HEADER = 'X-Force-Fetch'

function isJwtLike(value) {
  if (typeof value !== 'string') {
    return false
  }

  const parts = value.trim().split('.')
  return parts.length === 3 && parts.every(Boolean)
}

export function extractAssistantJwt(result) {
  const candidates = [
    result?.data?.session?.token,
    result?.session?.token,
    result?.data?.token,
    result?.token,
  ]

  return candidates.find(isJwtLike)?.trim() || null
}

async function readSessionToken(auth, { force = false } = {}) {
  if (typeof auth?.getSession !== 'function') {
    return { token: null, hasSession: false, error: null }
  }

  try {
    const result = force
      ? await auth.getSession({
          fetchOptions: {
            cache: 'no-store',
            headers: {
              [FORCE_FETCH_HEADER]: 'true',
            },
          },
        })
      : await auth.getSession()

    return {
      token: extractAssistantJwt(result),
      hasSession: Boolean(result?.data?.session || result?.session),
      error: result?.error || null,
    }
  } catch (error) {
    return { token: null, hasSession: false, error }
  }
}

async function readDirectToken(auth) {
  if (typeof auth?.token !== 'function') {
    return { token: null, error: null }
  }

  try {
    const result = await auth.token()
    return {
      token: extractAssistantJwt(result),
      error: result?.error || null,
    }
  } catch (error) {
    return { token: null, error }
  }
}

export async function getAssistantJwt(auth, { forceRefresh = false } = {}) {
  const firstSession = await readSessionToken(auth, { force: forceRefresh })
  if (firstSession.token) {
    return firstSession.token
  }

  const directToken = await readDirectToken(auth)
  if (directToken.token) {
    return directToken.token
  }

  if (!forceRefresh) {
    const refreshedSession = await readSessionToken(auth, { force: true })
    if (refreshedSession.token) {
      return refreshedSession.token
    }
  }

  const error = new Error(
    firstSession.hasSession
      ? 'Token assistant belum tersedia setelah sesi disegarkan. Muat ulang halaman lalu coba lagi.'
      : 'Sesi akun sudah berakhir. Silakan login kembali.'
  )
  error.code = firstSession.hasSession
    ? 'ASSISTANT_TOKEN_UNAVAILABLE'
    : 'ASSISTANT_SESSION_EXPIRED'
  error.cause = directToken.error || firstSession.error || null
  throw error
}

