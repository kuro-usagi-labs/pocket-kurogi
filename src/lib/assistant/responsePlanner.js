const MUTATION_INTENTS = new Set([
  'record_expense',
  'record_income',
  'record_multiple_transactions',
  'transfer_money',
  'create_budget',
  'update_budget',
  'create_saving_goal',
  'update_saving_goal',
])

const QUERY_INTENTS = new Set([
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

export function planAssistantResponse({
  intent = 'unknown',
  status = 'ready',
  confidence = 0,
  emotion = { emotion: 'neutral' },
  communicationStyle = 'balanced',
  hasInsight = false,
  hasPendingAction = false,
  hasClarification = false,
} = {}) {
  const emotional = emotion.emotion && emotion.emotion !== 'neutral'
  const mutation = MUTATION_INTENTS.has(intent)
  const query = QUERY_INTENTS.has(intent)
  const cautious =
    status === 'blocked' ||
    status === 'clarification' ||
    (!hasPendingAction && confidence > 0 && confidence < 0.62)
  const needsWarning =
    status === 'blocked' ||
    (!hasPendingAction && confidence > 0 && confidence < 0.62)
  const verbosity = communicationStyle === 'concise'
    ? 'concise'
    : communicationStyle === 'detailed'
      ? 'detailed'
      : emotional || intent === 'financial_advice'
        ? 'supportive'
        : 'balanced'

  return {
    version: 1,
    tone: emotional
      ? 'empathetic'
      : cautious
        ? 'careful'
        : 'friendly',
    verbosity,
    structure: {
      acknowledgment:
        (mutation || query) &&
        status !== 'clarification' &&
        !hasPendingAction,
      empathy: emotional,
      interpretation:
        mutation ||
        intent === 'calculate_change' ||
        status === 'clarification',
      details: intent === 'record_multiple_transactions',
      insight: Boolean(hasInsight),
      warning: needsWarning,
      clarification: Boolean(hasClarification),
      confirmation: false,
      nextSuggestion:
        verbosity !== 'concise' &&
        intent === 'calculate_change',
    },
    constraints: {
      preserveFinancialFacts: true,
      neverClaimWriteBeforeConfirmation: mutation,
      maximumPrimarySections: verbosity === 'concise' ? 2 : 4,
      maximumSecondarySections: verbosity === 'detailed' ? 6 : 4,
    },
  }
}

export function applyResponsePlan(components, plan) {
  if (!plan?.structure) return components
  return Object.fromEntries(
    Object.entries(components).map(([key, value]) => [
      key,
      plan.structure[key] === false ? null : value,
    ])
  )
}
