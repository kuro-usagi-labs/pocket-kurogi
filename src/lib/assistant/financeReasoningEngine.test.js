import { describe, expect, it } from 'vitest'
import { reasonAboutFinancialHealth } from './financeReasoningEngine'

describe('finance reasoning engine', () => {
  it('prioritizes an exceeded budget using database evidence', () => {
    const result = reasonAboutFinancialHealth({
      wallets: [{ id: 'cash', current_balance: 200_000 }],
      snapshot: {
        sourceTransactionCount: 3,
        currentMonth: { netCashflow: -50_000 },
        topCategories: [{ name: 'Jajan', amount: 300_000 }],
        budgetUsage: [{
          category: 'Jajan',
          percentage: 150,
          spent: 300_000,
          limit: 200_000,
        }],
      },
    })

    expect(result).toMatchObject({
      code: 'BUDGET_EXCEEDED',
      severity: 'high',
      focusCategory: 'Jajan',
      constraints: { factsFromDatabaseOnly: true },
    })
  })

  it('does not invent advice when no financial baseline exists', () => {
    const result = reasonAboutFinancialHealth({
      wallets: [],
      snapshot: { sourceTransactionCount: 0 },
    })

    expect(result.code).toBe('INSUFFICIENT_DATA')
    expect(result.actions).toContain('record_income_or_initial_balance')
  })

  it('recognizes a stable tracked position without overpromising', () => {
    const result = reasonAboutFinancialHealth({
      wallets: [{ id: 'bca', current_balance: 2_000_000 }],
      snapshot: {
        sourceTransactionCount: 10,
        currentMonth: { netCashflow: 500_000 },
        topCategories: [{ name: 'Makan', amount: 300_000 }],
        budgetUsage: [],
      },
    })

    expect(result.code).toBe('STABLE')
    expect(result.constraints.recommendationNotGuarantee).toBe(true)
  })
})
