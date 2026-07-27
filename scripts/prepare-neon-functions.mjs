import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = new URL('../', import.meta.url)

const AUTH_SOURCE = `import { createRemoteJWKSet, jwtVerify } from 'jose'

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
`

function replaceDenoServe(source, nextMarker) {
  const opened = source.replace(
    'Deno.serve(async (request) => {',
    'export default async function handler(request) {',
  )
  const closing = `\n})\n\n${nextMarker}`
  if (!opened.includes(closing)) {
    throw new Error(`Could not locate Deno.serve closing before ${nextMarker}`)
  }
  return opened.replace(closing, `\n}\n\n${nextMarker}`)
}

function replaceDenoEnv(source) {
  return source.replace(
    /Deno\.env\.get\('([A-Z0-9_]+)'\)/g,
    (_, name) => `process.env.${name}`,
  )
}

function transformAnalyze(source) {
  let output = source.replaceAll('\r\n', '\n').replace(
    "import { createClient } from 'npm:@supabase/supabase-js@2'",
    "import { AuthError, requireAuthenticatedUser } from './auth.ts'",
  )
  output = output.replace('class AuthError extends Error {}\n', '')
  output = replaceDenoServe(output, 'async function callGeminiAPI')
  output = output.replace(
    /async function requireAuthenticatedUser\(request: Request\) \{[\s\S]*?\n\}\n\nfunction validatePayload/,
    'function validatePayload',
  )
  output = replaceDenoEnv(output)
  return output.replaceAll('Supabase Edge Functions', 'Neon Functions')
}

function transformTranscribe(source) {
  let output = source.replaceAll('\r\n', '\n').replace(
    "import { createClient } from 'npm:@supabase/supabase-js@2'",
    "import { AuthError, requireAuthenticatedUser as requireUser } from './auth.ts'",
  )
  output = output.replace('class AuthError extends Error {}\n', '')
  output = replaceDenoServe(output, 'async function requireUser')
  output = output.replace(
    /async function requireUser\(request: Request\) \{[\s\S]*?\n\}\n\nasync function readPayload/,
    'async function readPayload',
  )
  output = replaceDenoEnv(output)
  output = output.replace('user.id', 'user.userId')
  return output.replaceAll('Supabase Edge Functions', 'Neon Functions')
}

async function writeFunction(slug, transform) {
  const sourcePath = new URL(`supabase/functions/${slug}/index.ts`, ROOT)
  const targetDirectory = new URL(`neon/functions/${slug}/`, ROOT)
  const source = await fs.readFile(sourcePath, 'utf8')

  await fs.mkdir(targetDirectory, { recursive: true })
  await Promise.all([
    fs.writeFile(new URL('index.ts', targetDirectory), transform(source)),
    fs.writeFile(new URL('auth.ts', targetDirectory), AUTH_SOURCE),
  ])
}

await Promise.all([
  writeFunction('analyze-transaction', transformAnalyze),
  writeFunction('transcribe-voice', transformTranscribe),
])

process.stdout.write('Neon Function sources prepared\n')
