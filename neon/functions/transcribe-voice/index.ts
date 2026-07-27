import { AuthError, requireAuthenticatedUser as requireUser } from './auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_AUDIO_BYTES = 8 * 1024 * 1024
const GEMINI_TIMEOUT_MS = 20_000
const SUPPORTED_MIME_TYPES = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
])

type TranscribePayload = {
  audioBase64?: string
  mimeType?: string
}

class ValidationError extends Error {}

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const requestId = crypto.randomUUID()
  const startedAt = Date.now()

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, { status: 405 }, requestId)
  }

  try {
    const user = await requireUser(request)
    const payload = await readPayload(request)
    const text = await transcribeWithGemini(payload)

    console.info('transcribe-voice success', {
      requestId,
      userId: user.userId,
      durationMs: Date.now() - startedAt,
    })

    return jsonResponse({
      text,
    }, {}, requestId)
  } catch (error) {
    const status = error instanceof AuthError
      ? 401
      : error instanceof ValidationError
        ? 400
        : isTimeoutError(error)
          ? 504
          : 500

    console.error('transcribe-voice failed', {
      requestId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return jsonResponse(
      {
        error: publicErrorMessage(error),
      },
      { status },
      requestId,
    )
  }
}

async function readPayload(request: Request): Promise<Required<TranscribePayload>> {
  if (request.method !== 'POST') {
    throw new ValidationError('Method not allowed')
  }

  const payload = await request.json().catch(() => null) as TranscribePayload | null
  const audioBase64 = String(payload?.audioBase64 || '').trim()
  const mimeType = String(payload?.mimeType || 'audio/webm').trim().toLowerCase()

  if (!audioBase64) {
    throw new ValidationError('Audio kosong.')
  }

  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new ValidationError('Format audio belum didukung.')
  }

  const byteLength = estimateBase64Bytes(audioBase64)
  if (byteLength <= 0 || byteLength > MAX_AUDIO_BYTES) {
    throw new ValidationError('Voice note terlalu besar atau tidak valid.')
  }

  return { audioBase64, mimeType }
}

async function transcribeWithGemini({ audioBase64, mimeType }: Required<TranscribePayload>) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in Neon Functions.')
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: [
                  'Transkripsikan audio Bahasa Indonesia ini menjadi satu kalimat perintah chat keuangan.',
                  'Kembalikan hanya teks transkrip, tanpa markdown, tanpa penjelasan, tanpa tanda kutip.',
                ].join(' '),
              },
              {
                inlineData: {
                  mimeType,
                  data: audioBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 180,
        },
      }),
    },
  )

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    console.error('Transcription provider rejected', {
      status: response.status,
      detail: message.slice(0, 160),
    })
    throw new Error(`Transcription provider error: ${response.status}`)
  }

  const data = await response.json()
  const text = String(data?.candidates?.[0]?.content?.parts?.[0]?.text || '')
    .replace(/^["']|["']$/g, '')
    .trim()

  if (!text) {
    throw new ValidationError('Audio belum menghasilkan transkrip.')
  }

  return text.slice(0, 2_000)
}

function estimateBase64Bytes(value: string) {
  const normalized = value.replace(/\s/g, '')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    return -1
  }
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0
  return Math.floor((normalized.length * 3) / 4) - padding
}

function publicErrorMessage(error: unknown) {
  if (error instanceof AuthError) return 'Sesi login tidak valid. Silakan masuk kembali.'
  if (error instanceof ValidationError) return error.message
  if (isTimeoutError(error)) return 'Transkripsi terlalu lama. Coba rekam lebih singkat.'
  return 'Voice note belum bisa ditranskrip. Coba lagi sebentar.'
}

function isTimeoutError(error: unknown) {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
}

function jsonResponse(body: Record<string, unknown>, init: ResponseInit = {}, requestId?: string) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(requestId ? { 'X-AI-Request-Id': requestId } : {}),
      ...(init.headers || {}),
    },
  })
}
