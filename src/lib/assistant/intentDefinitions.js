export const ASSISTANT_INTENTS = Object.freeze([
  'record_expense',
  'record_income',
  'record_multiple_transactions',
  'transfer_money',
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
  'select_wallet',
  'general_chat',
  'unknown',
])

export const MUTATING_ASSISTANT_INTENTS = Object.freeze([
  'record_expense',
  'record_income',
  'record_multiple_transactions',
  'transfer_money',
  'create_budget',
  'update_budget',
  'create_saving_goal',
  'update_saving_goal',
  'correct_pending_action',
])

export const INTENT_DEFINITIONS = Object.freeze({
  record_expense: {
    required: ['amount', 'description', 'wallet'],
    optional: ['category', 'merchant', 'occurredAt', 'notes'],
    actionType: 'record_transactions',
    mutates: true,
  },
  record_income: {
    required: ['amount', 'description', 'wallet'],
    optional: ['category', 'merchant', 'occurredAt', 'notes'],
    actionType: 'record_transactions',
    mutates: true,
  },
  record_multiple_transactions: {
    required: ['items', 'wallet'],
    optional: ['occurredAt', 'notes'],
    actionType: 'record_transactions',
    mutates: true,
  },
  transfer_money: {
    required: ['amount', 'sourceWallet', 'destinationWallet'],
    optional: ['occurredAt', 'notes'],
    actionType: 'transfer_money',
    mutates: true,
  },
  calculate_change: {
    required: ['tenderedAmount', 'changeAmount'],
    optional: ['description', 'wallet'],
    mutates: false,
  },
  query_balance: {
    required: [],
    optional: ['wallet'],
    queryType: 'balance',
    mutates: false,
  },
  query_transactions: {
    required: [],
    optional: ['wallet', 'category', 'startAt', 'endAt', 'transactionType'],
    queryType: 'transactions',
    mutates: false,
  },
  query_income: {
    required: [],
    optional: ['wallet', 'category', 'startAt', 'endAt'],
    queryType: 'income',
    mutates: false,
  },
  query_expenses: {
    required: [],
    optional: ['wallet', 'category', 'startAt', 'endAt'],
    queryType: 'expenses',
    mutates: false,
  },
  query_spending_summary: {
    required: [],
    optional: ['startAt', 'endAt'],
    queryType: 'spending_summary',
    mutates: false,
  },
  query_category_summary: {
    required: [],
    optional: ['category', 'startAt', 'endAt'],
    queryType: 'category_summary',
    mutates: false,
  },
  query_wallet: {
    required: ['wallet'],
    optional: ['startAt', 'endAt'],
    queryType: 'wallet',
    mutates: false,
  },
  create_budget: {
    required: ['category', 'amount'],
    optional: ['period'],
    actionType: 'upsert_budget',
    mutates: true,
  },
  update_budget: {
    required: ['category', 'amount'],
    optional: ['period'],
    actionType: 'upsert_budget',
    mutates: true,
  },
  query_budget: {
    required: [],
    optional: ['category', 'period'],
    queryType: 'budget',
    mutates: false,
  },
  create_saving_goal: {
    required: ['description', 'amount'],
    optional: ['deadline', 'initialAmount', 'sourceWallet'],
    actionType: 'create_saving_goal',
    mutates: true,
  },
  update_saving_goal: {
    required: ['goal', 'amount'],
    optional: ['deadline'],
    actionType: 'update_saving_goal',
    mutates: true,
  },
  query_saving_goal: {
    required: [],
    optional: ['goal'],
    queryType: 'saving_goal',
    mutates: false,
  },
  financial_advice: {
    required: [],
    optional: ['startAt', 'endAt', 'focus'],
    queryType: 'financial_advice',
    mutates: false,
  },
  emotional_support: {
    required: [],
    optional: ['emotion', 'financialConcern'],
    queryType: 'emotional_support',
    mutates: false,
  },
  confirm_pending_action: {
    required: ['pendingActionId'],
    optional: [],
    mutates: false,
  },
  cancel_pending_action: {
    required: ['pendingActionId'],
    optional: [],
    mutates: false,
  },
  correct_pending_action: {
    required: ['pendingActionId', 'correction'],
    optional: [],
    actionType: 'correct_pending_action',
    mutates: true,
  },
  select_wallet: {
    required: ['wallet'],
    optional: [],
    mutates: false,
  },
  general_chat: {
    required: [],
    optional: [],
    mutates: false,
  },
  unknown: {
    required: [],
    optional: [],
    mutates: false,
  },
})

export function getIntentDefinition(intent) {
  return INTENT_DEFINITIONS[intent] || INTENT_DEFINITIONS.unknown
}

export function isMutatingAssistantIntent(intent) {
  return MUTATING_ASSISTANT_INTENTS.includes(intent)
}
