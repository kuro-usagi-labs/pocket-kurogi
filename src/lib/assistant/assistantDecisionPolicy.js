const CANONICAL_PIPELINE_INTENTS = new Set([
  'record_expense',
  'record_income',
  'record_multiple_transactions',
  'transfer_money',
  'query_balance',
  'query_transactions',
  'query_income',
  'query_expenses',
  'query_spending_summary',
  'query_category_summary',
  'query_wallet',
  'create_budget',
  'update_budget',
  'query_budget',
  'create_saving_goal',
  'update_saving_goal',
  'query_saving_goal',
  'financial_advice',
  'emotional_support',
  'confirm_pending_action',
  'cancel_pending_action',
  'correct_pending_action',
])

const LEGACY_CAPABILITY_PATTERN =
  /\b(?:buat(?:kan)?|bikin(?:kan)?|tambah(?:kan)?)\s+(?:dompet|wallet|rekening)\b|\b(?:hapus|arsipkan|pulihkan|restore|rename|ganti nama|ubah nama)\s+(?:dompet|wallet|rekening)\b|\b(?:ajari|ajarkan|lupakan aturan|kalau (?:aku|saya) bilang)\b|\b(?:setor|tabung|nabung|simpan|alokasi|pindah(?:kan)?|transfer|geser|cairkan|tarik)\b.{0,48}\b(?:target|tabungan|simpanan|goal|milestone)\b|\b(?:kembalian|susuk)\b/iu

export const ASSISTANT_DECISION_HANDLERS = Object.freeze({
  CANONICAL: 'canonical_pipeline',
  LEGACY_ADAPTER: 'legacy_adapter',
  LEGACY_PENDING: 'legacy_pending_action',
  MEMORY_CONFIRMATION: 'memory_confirmation',
  MEMORY_PROPOSAL: 'memory_proposal',
})

/**
 * The only policy allowed to choose who handles a user message.
 *
 * Specialist parsers may extract candidates, but callers must execute exactly
 * this decision and must never fall through to a second handler.
 */
export function decideAssistantHandler({
  frame,
  canonicalPendingAction = null,
  legacyPendingAction = null,
  pendingMemoryProposal = null,
  memoryProposalDecision = null,
  memoryCandidates = [],
} = {}) {
  if (!frame) {
    throw new Error('Semantic frame wajib tersedia sebelum memilih handler.')
  }

  if (canonicalPendingAction) {
    return buildDecision(ASSISTANT_DECISION_HANDLERS.CANONICAL, frame, {
      reason: 'canonical_pending_action',
      stateConflict: Boolean(legacyPendingAction),
    })
  }

  if (legacyPendingAction) {
    return buildDecision(ASSISTANT_DECISION_HANDLERS.LEGACY_PENDING, frame, {
      reason: 'legacy_pending_action_adapter',
    })
  }

  if (pendingMemoryProposal && ['confirm', 'cancel'].includes(memoryProposalDecision)) {
    return buildDecision(ASSISTANT_DECISION_HANDLERS.MEMORY_CONFIRMATION, frame, {
      reason: `memory_proposal_${memoryProposalDecision}`,
      memoryProposalDecision,
    })
  }

  if (
    memoryCandidates.length > 0 &&
    frame.action?.kind === 'conversation' &&
    ['general_chat', 'unknown'].includes(frame.legacyIntent || frame.intent)
  ) {
    return buildDecision(ASSISTANT_DECISION_HANDLERS.MEMORY_PROPOSAL, frame, {
      reason: 'explicit_memory_candidate',
    })
  }

  if (canCanonicalPipelineHandle(frame)) {
    return buildDecision(ASSISTANT_DECISION_HANDLERS.CANONICAL, frame, {
      reason: 'canonical_intent_supported',
    })
  }

  return buildDecision(ASSISTANT_DECISION_HANDLERS.LEGACY_ADAPTER, frame, {
    reason: 'temporary_legacy_capability',
  })
}

export function canCanonicalPipelineHandle(frame) {
  const intent = frame?.legacyIntent || frame?.intent
  if (requiresLegacyCapability(frame, intent)) return false
  if (CANONICAL_PIPELINE_INTENTS.has(intent)) return true

  if (
    frame?.action?.actionType &&
    ![
      'record_transactions',
      'transfer_money',
      'upsert_budget',
      'create_saving_goal',
      'update_saving_goal',
      'correct_pending_action',
    ].includes(frame.action.actionType)
  ) {
    return false
  }

  // Unsafe mutation-shaped input must be answered by the central safety path,
  // even when intent confidence is too low for a concrete action.
  return Boolean(frame?.action?.mutates && frame?.safety?.blocksWrite)
}

function requiresLegacyCapability(frame, intent) {
  const text = String(frame?.utterance?.normalized || '')

  if (LEGACY_CAPABILITY_PATTERN.test(text)) return true
  if (intent === 'calculate_change') return true
  if (
    intent === 'record_multiple_transactions' &&
    /\b(?:pakai|dari|bawa|kasih|serahkan)(?:\s+(?:dengan|sebesar))?\s+uang\b/iu.test(text)
  ) {
    return true
  }
  if (
    intent === 'create_saving_goal' &&
    (
      (frame?.entities?.amounts?.length || 0) > 1 ||
      /\b(?:setoran awal|modal awal|mulai dengan|isi awal)\b/iu.test(text)
    )
  ) {
    return true
  }

  const lowBalanceScenario =
    /(?:\b(?:saldo|uang|dompet|rekening)\b.{0,45}\b(?:tinggal|sisa|cuma|hanya|menipis)\b|\b(?:tinggal|sisa|cuma|hanya)\b.{0,30}\b(?:rp\s*)?\d)/iu.test(text)
  const runwayHorizon =
    /\b(?:hari|minggu|pekan|bulan|sebulan|akhir bulan|sampai gajian|gajian|hemat|prioritas|cukup|gimana|bagaimana)\b/iu.test(text)
  return lowBalanceScenario && runwayHorizon
}

function buildDecision(handler, frame, details) {
  return Object.freeze({
    version: 1,
    handler,
    intent: frame.canonicalIntent || frame.intent,
    legacyIntent: frame.legacyIntent || frame.intent,
    final: true,
    allowFallback: false,
    ...details,
  })
}
