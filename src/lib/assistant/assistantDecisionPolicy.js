const CANONICAL_PIPELINE_INTENTS = new Set([
  'record_expense',
  'record_income',
  'record_multiple_transactions',
  'transfer_money',
  'create_wallet',
  'rename_wallet',
  'archive_wallet',
  'restore_wallet',
  'deposit_goal',
  'withdraw_goal',
  'calculate_change',
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
  'general_chat',
])

export const ASSISTANT_DECISION_HANDLERS = Object.freeze({
  CANONICAL: 'canonical_pipeline',
  LEARNING_RULE: 'canonical_learning_rule',
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
  pendingMemoryProposal = null,
  memoryProposalDecision = null,
  memoryCandidates = [],
  learningRuleCandidate = null,
} = {}) {
  if (!frame) {
    throw new Error('Semantic frame wajib tersedia sebelum memilih handler.')
  }

  if (canonicalPendingAction) {
    return buildDecision(ASSISTANT_DECISION_HANDLERS.CANONICAL, frame, {
      reason: 'canonical_pending_action',
    })
  }

  if (learningRuleCandidate) {
    return buildDecision(ASSISTANT_DECISION_HANDLERS.LEARNING_RULE, frame, {
      reason: learningRuleCandidate.type === 'unknown'
        ? `learning_rule_rejected:${learningRuleCandidate.reason}`
        : 'explicit_learning_rule',
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
    ['general_chat', 'unknown'].includes(frame.intent)
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

  return buildDecision(ASSISTANT_DECISION_HANDLERS.CANONICAL, frame, {
    reason: 'canonical_unknown_or_unsupported',
  })
}

export function canCanonicalPipelineHandle(frame) {
  const intent = frame?.intent
  if (CANONICAL_PIPELINE_INTENTS.has(intent)) return true

  if (
    frame?.action?.actionType &&
    ![
      'record_transactions',
      'transfer_money',
      'upsert_budget',
      'create_saving_goal',
      'update_saving_goal',
      'create_wallet',
      'rename_wallet',
      'archive_wallet',
      'restore_wallet',
      'deposit_goal',
      'withdraw_goal',
      'correct_pending_action',
    ].includes(frame.action.actionType)
  ) {
    return false
  }

  // Unsafe mutation-shaped input must be answered by the central safety path,
  // even when intent confidence is too low for a concrete action.
  return Boolean(frame?.action?.mutates && frame?.safety?.blocksWrite)
}

function buildDecision(handler, frame, details) {
  return Object.freeze({
    version: 1,
    handler,
    intent: frame.canonicalIntent || frame.intent,
    final: true,
    allowFallback: false,
    ...details,
  })
}
