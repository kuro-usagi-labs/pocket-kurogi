export const CHAT_WRITE_INTENT_TYPES = Object.freeze([
  'transaction',
  'transaction_batch',
  'undo_transaction',
  'correct_last_transaction',
  'rename_wallet',
  'delete_wallet',
  'restore_wallet',
  'create_wallet',
  'goal_contribution',
  'goal_creation_pending',
  'goal_withdrawal',
  'transfer',
])

const CHAT_WRITE_INTENT_TYPE_SET = new Set(CHAT_WRITE_INTENT_TYPES)

export function getChatWriteCandidate(analysis) {
  if (!analysis || typeof analysis !== 'object') return null
  if (analysis.type === 'needs_confirmation') return analysis.intent || null
  return analysis
}

export function isChatWriteIntentType(type) {
  return CHAT_WRITE_INTENT_TYPE_SET.has(type)
}

export function hasCommittedChatWriteDecision(analysis) {
  const candidate = getChatWriteCandidate(analysis)
  return Boolean(
    candidate &&
    isChatWriteIntentType(candidate.type) &&
    candidate.writeDecision === 'commit'
  )
}
