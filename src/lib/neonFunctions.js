import { neon } from './neon'

const functionUrls = {
  analyzetransaction: import.meta.env.VITE_NEON_ANALYZE_TRANSACTION_URL,
  transcribevoice: import.meta.env.VITE_NEON_TRANSCRIBE_VOICE_URL,
}

const FUNCTION_TIMEOUT_MS = 25_000

export async function invokeNeonFunction(name, body) {
  const url = functionUrls[name]
  if (!url) {
    return {
      data: null,
      error: new Error(`Neon Function ${name} belum dikonfigurasi.`),
    }
  }

  const { data: tokenData, error: sessionError } = await neon.auth.token()

  if (sessionError || !tokenData?.token) {
    return {
      data: null,
      error: sessionError || new Error('Sesi login tidak tersedia.'),
    }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(FUNCTION_TIMEOUT_MS),
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => null)

    if (!response.ok) {
      return {
        data: null,
        error: new Error(data?.error || `Neon Function gagal (${response.status}).`),
      }
    }

    if (!data) {
      return {
        data: null,
        error: new Error('Backend mengirim jawaban yang tidak valid.'),
      }
    }

    return { data, error: null }
  } catch (error) {
    const normalizedError = error?.name === 'TimeoutError'
      ? new Error('Backend terlalu lama merespons. Coba kirim lagi.')
      : error
    return { data: null, error: normalizedError }
  }
}
