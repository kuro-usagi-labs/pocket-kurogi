import { createRemoteJWKSet, jwtVerify } from 'jose'

export class AuthError extends Error {}

let jwks

export async function requireAuthenticatedUser(request) {
  const authorization = request.headers.get('Authorization')?.trim() || ''
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    throw new AuthError('Unauthorized')
  }

  const jwksUrl = process.env.NEON_AUTH_JWKS_URL
  if (!jwksUrl) {
    throw new Error('NEON_AUTH_JWKS_URL is not configured.')
  }

  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUrl))
  }

  try {
    const { payload } = await jwtVerify(authorization.slice(7), jwks)
    if (!payload.sub) {
      throw new Error('Missing subject')
    }
    return { userId: payload.sub }
  } catch {
    throw new AuthError('Unauthorized')
  }
}
