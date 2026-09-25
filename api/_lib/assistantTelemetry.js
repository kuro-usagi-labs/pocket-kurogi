const OPERATIONS = new Set(['get_state', 'stage_action', 'confirm_action', 'correct_action', 'cancel_action', 'financial_report', 'transaction_history', 'language', 'interpret', 'interpret_v2', 'save_dialogue', 'supersede_actions', 'remember', 'forget_memory', 'forget_all_memory', 'financial_context'])
const REASONS = new Set(['disabled', 'invalid_input', 'unauthenticated', 'configuration', 'cooldown', 'busy', 'daily_quota', 'rate_limit', 'invalid_response', 'cooldown_store_unavailable', 'timeout', 'provider_error', 'unavailable'])
const STAGES = new Set(['authentication', 'validation', 'language_context', 'provider', 'database', 'report'])

// Deliberately exclude prompts, payloads, identities, tokens, amounts and raw errors.
export function assistantDiagnostic({ requestId, operation, stage, outcome, reason, startedAt, statusCode }, now = Date.now()) {
  return {
    event: 'assistant_request',
    requestId: /^[a-f0-9-]{36}$/i.test(requestId || '') ? requestId : undefined,
    operation: OPERATIONS.has(operation) ? operation : 'other',
    stage: STAGES.has(stage) ? stage : 'validation',
    outcome: ['success', 'fallback', 'error'].includes(outcome) ? outcome : 'error',
    reason: REASONS.has(reason) ? reason : undefined,
    durationMs: Math.max(0, now - startedAt),
    statusCode: Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599 ? statusCode : undefined,
  }
}
