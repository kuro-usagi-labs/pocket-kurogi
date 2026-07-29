const HANDLED_MUTATION_INTENTS = new Set([
  'record_expense',
  'record_income',
  'record_multiple_transactions',
  'transfer_money',
  'create_budget',
  'update_budget',
  'create_saving_goal',
  'update_saving_goal',
])

const UNSAFE_MUTATION_CODES = new Set([
  'FOREIGN_CURRENCY',
  'THIRD_PARTY_OWNERSHIP',
  'HYPOTHETICAL_OR_FUTURE',
  'QUESTION_NOT_ACTION',
  'NEGATED_ACTION',
])

const HANDLED_QUERY_INTENTS = new Set([
  'query_balance',
  'query_transactions',
  'query_income',
  'query_expenses',
  'query_spending_summary',
  'query_category_summary',
  'query_wallet',
  'query_budget',
  'query_saving_goal',
  'financial_advice',
  'emotional_support',
])

export function shouldHandleAssistantEngineResult(result, {
  hasPendingAction = false,
} = {}) {
  if (!result) return false
  if (hasPendingAction && result.command) return true
  if (shouldDelegateToConversationalParser(result)) return false
  if (
    !hasPendingAction &&
    /\b(?:koreksi|revisi|ubah|ganti|harusnya|seharusnya|yang tadi)\b/iu.test(result.text)
  ) {
    return false
  }
  if (HANDLED_MUTATION_INTENTS.has(result.route?.intent)) return true
  if (HANDLED_QUERY_INTENTS.has(result.route?.intent)) return true
  if (result.route?.intent === 'cancel_pending_action') return true
  if (result.dialogue?.status === 'calculation') return true
  return result.safety?.errors?.some((error) => UNSAFE_MUTATION_CODES.has(error.code)) || false
}

function shouldDelegateToConversationalParser(result) {
  const normalizedText = String(
    result.entities?.normalizedText || result.text || ''
  ).toLowerCase()
  const intent = result.route?.intent

  // The conversational parser preserves a draft, so "catat yang tadi" can
  // safely record the spending amount derived from tender and change.
  if (intent === 'calculate_change') return true

  if (
    /\b(?:teman|temen|istri|suami|adik|kakak|ibu|ayah|mama|papa|pacar|anak|saudara|rekan|dia|mereka|bos)(?:ku|nya)?\b.{0,45}\b(?:transfer|kirim(?:kan)?|kasih|beri)\b.{0,35}\b(?:ke|kepada|buat)\s+(?:saya|aku|gue|gw)\b/iu.test(
      normalizedText
    )
  ) {
    return true
  }

  // A tendered amount ("pakai uang 50rb") is not another expense item.
  if (
    intent === 'record_multiple_transactions' &&
    /\b(?:pakai|dari|bawa|kasih|serahkan)(?:\s+(?:dengan|sebesar))?\s+uang\b/iu.test(
      normalizedText
    )
  ) {
    return true
  }

  // Runway questions can supply a hypothetical balance that must not replace
  // the actual database balance.
  const hasLowBalanceScenario =
    /(?:\b(?:saldo|uang|dompet|rekening)\b.{0,45}\b(?:tinggal|sisa|cuma|hanya|menipis)\b|\b(?:tinggal|sisa|cuma|hanya)\b.{0,30}\b(?:rp\s*)?\d)/iu.test(
      normalizedText
    )
  const hasRunwayHorizon =
    /\b(?:hari|minggu|pekan|bulan|sebulan|akhir bulan|sampai gajian|gajian|hemat|prioritas|cukup|gimana|bagaimana)\b/iu.test(
      normalizedText
    )
  if (hasLowBalanceScenario && hasRunwayHorizon) return true

  if (
    intent === 'create_saving_goal' &&
    (
      (result.entities?.amounts?.length || 0) > 1 ||
      /\b(?:setoran awal|modal awal|mulai dengan|isi awal)\b/iu.test(normalizedText)
    )
  ) {
    return true
  }

  return false
}

export function isAssistantInsightIntent(intent) {
  return HANDLED_QUERY_INTENTS.has(intent)
}

export function buildAssistantPendingResponse(result, persistedAction = null) {
  const pendingAction = persistedAction || result.pendingAction
  const card = result.response?.card
    ? {
        ...result.response.card,
        id: pendingAction?.id || result.response.card.id,
        status: pendingAction?.status || result.response.card.status,
        payloadHash: pendingAction?.payloadHash || null,
      }
    : null

  return {
    text: result.response?.text || 'Rincian aksi sudah disiapkan dan belum mengubah data.',
    card,
    intentStatus: result.dialogue?.status === 'pending_confirmation'
      ? 'needs_confirmation'
      : undefined,
    metadata: {
      assistantEngineVersion: result.version,
      conversationStatus: result.dialogue?.status,
      dialogueState: result.dialogueState,
      pendingActionId: pendingAction?.id || null,
      confirmationMode: result.dialogue?.status === 'pending_confirmation'
        ? 'card'
        : result.dialogue?.status === 'clarification'
          ? 'input'
          : undefined,
      missingSlots: result.slots?.missingSlots || [],
      candidates: result.dialogue?.clarification?.candidates || [],
    },
  }
}

export function buildAssistantExecutionResponse(action, executionResult) {
  const data = executionResult?.data || executionResult
  const replayed = Boolean(data?.replayed)
  const payload = action?.payload || {}

  if (action?.actionType === 'record_transactions') {
    const items = Array.isArray(payload.items) ? payload.items : []
    const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    return {
      text: replayed
        ? 'Konfirmasi ini sudah pernah diproses. Saldo tidak diubah dua kali.'
        : items.length > 1
          ? `${items.length} transaksi dengan total ${formatRupiah(total)} berhasil dicatat.`
          : `${items[0]?.transactionType === 'income' ? 'Pemasukan' : 'Pengeluaran'} ${formatRupiah(total)} berhasil dicatat.`,
      card: {
        batch: items.length > 1,
        amount: total,
        type: items[0]?.transactionType || 'expense',
        category: items[0]?.category || 'Lainnya',
        wallet: items[0]?.wallet || null,
        desc: items[0]?.description || 'Transaksi',
        items: items.map((item) => ({
          type: item.transactionType,
          amount: item.amount,
          category: item.category || 'Lainnya',
          wallet: item.wallet,
          desc: item.description,
          canEdit: false,
          canDelete: false,
        })),
      },
      metadata: {
        conversationStatus: 'completed',
        pendingActionResolved: action.id,
        idempotentReplay: replayed,
      },
    }
  }

  if (action?.actionType === 'transfer_money') {
    return {
      text: replayed
        ? 'Transfer ini sudah pernah diproses. Saldo tidak dipindahkan dua kali.'
        : `Transfer ${formatRupiah(payload.amount)} dari ${payload.sourceWallet} ke ${payload.destinationWallet} berhasil.`,
      metadata: {
        conversationStatus: 'completed',
        pendingActionResolved: action.id,
        idempotentReplay: replayed,
      },
    }
  }

  return {
    text: replayed
      ? 'Aksi ini sudah pernah diproses dan tidak dijalankan dua kali.'
      : 'Aksi keuangan berhasil dijalankan.',
    metadata: {
      conversationStatus: 'completed',
      pendingActionResolved: action?.id || null,
      idempotentReplay: replayed,
    },
  }
}

export function buildAssistantCancellationResponse(action) {
  return {
    text: 'Baik, aksi keuangan itu dibatalkan. Tidak ada data yang diubah.',
    metadata: {
      conversationStatus: 'cancelled',
      pendingActionCancelled: action?.id || null,
    },
  }
}

export function buildAssistantCorrectionResponse(action) {
  const payload = action?.payload || {}
  const items = Array.isArray(payload.items) ? payload.items : []
  const amount = items.length > 0
    ? items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    : Number(payload.amount || 0)
  const firstItem = items[0] || null

  return {
    text: 'Rincian pending action sudah diperbarui. Periksa lagi sebelum mengonfirmasi.',
    card: {
      type: 'pending_action',
      id: action?.id,
      status: action?.status || 'pending',
      title: action?.actionType === 'transfer_money'
        ? 'Konfirmasi transfer antar-dompet'
        : items.length > 1
          ? 'Konfirmasi beberapa transaksi'
          : 'Konfirmasi transaksi',
      actionType: action?.actionType,
      amount,
      sourceWallet:
        payload.sourceWallet ||
        firstItem?.wallet ||
        null,
      destinationWallet: payload.destinationWallet || null,
      items: items.map((item, index) => ({
        id: item.clientItemId || `item-${index + 1}`,
        description: item.description || item.merchant || `Transaksi ${index + 1}`,
        amount: item.amount,
        category: item.category || null,
      })),
      missingFields: [],
      actions: ['confirm', 'edit', 'cancel'],
      expiresAt: action?.expiresAt,
      payloadHash: action?.payloadHash,
    },
    intentStatus: 'needs_confirmation',
    metadata: {
      conversationStatus: 'pending_confirmation',
      pendingActionId: action?.id || null,
      confirmationMode: 'card',
      pendingActionCorrected: true,
    },
  }
}

function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}
