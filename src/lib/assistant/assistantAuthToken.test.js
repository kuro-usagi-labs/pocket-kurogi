import { describe, expect, it, vi } from 'vitest'
import {
  extractAssistantJwt,
  getAssistantJwt,
} from './assistantAuthToken'

const JWT = 'header.payload.signature'

describe('assistant auth token', () => {
  it('reads the JWT injected into a Better Auth session by Neon', () => {
    expect(extractAssistantJwt({
      data: {
        session: {
          token: JWT,
        },
      },
    })).toBe(JWT)
  })

  it('supports the direct token response as a compatibility fallback', () => {
    expect(extractAssistantJwt({
      data: {
        token: JWT,
      },
    })).toBe(JWT)
  })

  it('does not send an opaque Better Auth session id as a bearer JWT', () => {
    expect(extractAssistantJwt({
      data: {
        session: {
          token: 'opaque-session-id',
        },
      },
    })).toBeNull()
  })

  it('uses getSession before the unreliable direct token endpoint', async () => {
    const auth = {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            token: JWT,
          },
        },
        error: null,
      }),
      token: vi.fn(),
    }

    await expect(getAssistantJwt(auth)).resolves.toBe(JWT)
    expect(auth.getSession).toHaveBeenCalledTimes(1)
    expect(auth.token).not.toHaveBeenCalled()
  })

  it('force-refreshes a cached session when neither initial source has a JWT', async () => {
    const auth = {
      getSession: vi.fn()
        .mockResolvedValueOnce({
          data: {
            session: {
              token: 'opaque-session-id',
            },
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            session: {
              token: JWT,
            },
          },
          error: null,
        }),
      token: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'token endpoint unavailable' },
      }),
    }

    await expect(getAssistantJwt(auth)).resolves.toBe(JWT)
    expect(auth.getSession).toHaveBeenLastCalledWith({
      fetchOptions: {
        cache: 'no-store',
        headers: {
          'X-Force-Fetch': 'true',
        },
      },
    })
  })

  it('reports an expired session only when no session remains', async () => {
    const auth = {
      getSession: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
      token: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    }

    await expect(getAssistantJwt(auth)).rejects.toMatchObject({
      code: 'ASSISTANT_SESSION_EXPIRED',
    })
  })
})

