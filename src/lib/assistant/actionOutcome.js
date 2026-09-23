export function classifyActionOutcome({ confirmedResult, requestSent }) {
  if (confirmedResult) return 'confirmed'
  return requestSent ? 'unknown' : 'failed'
}

// confirm_action atomically executes or returns its saved receipt for this
// exact ID/hash. Never restage or generate another idempotency key on retry.
export async function confirmWithReconciliation({ action, request }) {
  const body = { actionId: action.id, payloadHash: action.payloadHash }
  let lastError
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const data = await request({ operation: 'confirm_action', body, signal: AbortSignal.timeout(12000) })
      if (!data) throw new Error('Hasil aksi belum diterima.')
      return { data, error: null, outcome: classifyActionOutcome({ confirmedResult: data }) }
    } catch (error) {
      lastError = error
      // A definitive first-response rejection is not a lost execution receipt.
      // After any uncertain attempt, retain unknown even if a later call rejects.
      if (attempt === 0 && [400, 401, 403, 404, 409, 422].includes(error?.status)) {
        error.outcome = 'failed'
        return { data: null, error, outcome: 'failed' }
      }
    }
  }
  const error = new Error('Hasil pencatatan belum dapat dipastikan karena koneksi terputus. Jangan buat transaksi baru; konfirmasikan kembali aksi yang sama untuk memeriksa hasilnya.')
  error.cause = lastError
  error.outcome = 'unknown'
  return { data: null, error, outcome: classifyActionOutcome({ requestSent: true }) }
}
