const DISCRETIONARY_CATEGORY_PATTERN =
  /^(?:jajan|kopi|hiburan|game|nongkrong|belanja)$/iu

export function reasonAboutFinancialHealth({
  snapshot = null,
  wallets = [],
} = {}) {
  const activeWallets = wallets.filter((wallet) => !wallet?.is_archived)
  const activeBalance = activeWallets.reduce(
    (sum, wallet) => sum + Number(wallet.current_balance || 0),
    0
  )
  const hasTransactions = Boolean(snapshot?.sourceTransactionCount)
  const topCategory = snapshot?.topCategories?.[0] || null
  const exceededBudgets = (snapshot?.budgetUsage || [])
    .filter((entry) => Number(entry.percentage || 0) >= 100)
    .sort((left, right) => right.percentage - left.percentage)
  const netCashflow = Number(snapshot?.currentMonth?.netCashflow || 0)
  const discretionaryDeficit =
    Boolean(topCategory) &&
    DISCRETIONARY_CATEGORY_PATTERN.test(topCategory.name) &&
    netCashflow <= 0

  const evidence = {
    source: 'database',
    activeBalance,
    activeWalletCount: activeWallets.length,
    transactionCount: Number(snapshot?.sourceTransactionCount || 0),
    netCashflow,
    topCategory,
    exceededBudgets,
  }

  if (!hasTransactions && activeWallets.length === 0) {
    return createReasoningResult({
      code: 'INSUFFICIENT_DATA',
      severity: 'unknown',
      priority: 'collect_baseline',
      evidence,
      actions: ['record_income_or_initial_balance', 'record_required_expenses'],
    })
  }
  if (exceededBudgets.length > 0) {
    return createReasoningResult({
      code: 'BUDGET_EXCEEDED',
      severity: 'high',
      priority: 'pause_exceeded_category',
      focusCategory: exceededBudgets[0].category,
      evidence,
      actions: ['pause_discretionary_spending', 'protect_required_expenses'],
    })
  }
  if (discretionaryDeficit) {
    return createReasoningResult({
      code: 'DISCRETIONARY_DEFICIT',
      severity: 'high',
      priority: 'reduce_discretionary_category',
      focusCategory: topCategory.name,
      evidence,
      actions: ['reduce_top_discretionary_category', 'protect_required_expenses'],
    })
  }
  if (hasTransactions && netCashflow < 0) {
    return createReasoningResult({
      code: 'NEGATIVE_CASHFLOW',
      severity: 'high',
      priority: 'stabilize_cashflow',
      evidence,
      actions: ['pause_flexible_spending', 'review_required_expenses'],
    })
  }
  if (activeBalance <= 0) {
    return createReasoningResult({
      code: 'NO_ACTIVE_BALANCE',
      severity: 'medium',
      priority: 'record_available_funds',
      evidence,
      actions: ['record_income_or_initial_balance'],
    })
  }
  return createReasoningResult({
    code: 'STABLE',
    severity: 'low',
    priority: 'maintain_plan',
    evidence,
    actions: ['maintain_tracking', 'protect_required_expenses', 'fund_goals'],
  })
}

function createReasoningResult({
  code,
  severity,
  priority,
  focusCategory = null,
  evidence,
  actions,
}) {
  return {
    version: 1,
    code,
    severity,
    priority,
    focusCategory,
    evidence,
    actions,
    constraints: {
      factsFromDatabaseOnly: true,
      recommendationNotGuarantee: true,
    },
  }
}
