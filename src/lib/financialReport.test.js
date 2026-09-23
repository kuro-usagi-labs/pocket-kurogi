import { describe, expect, it } from 'vitest'
import { buildFinancialReport, reportPeriod, REPORT_LIMIT } from './financialReport'

const row = (overrides = {}) => ({ id: '1', amount: '100.00', transaction_type: 'expense', analytics_bucket: 'expense', occurred_at: '2026-09-01T00:00:00Z', category_name: 'Makan', category_type: 'expense', ...overrides })
describe('complete financial reports', () => {
  it('uses half-open Jakarta calendar months, including year rollover', () => {
    expect(reportPeriod('2026-12')).toMatchObject({ start: '2026-11-30T17:00:00.000Z', end: '2026-12-31T17:00:00.000Z' })
    expect(reportPeriod('2024-02').end).toBe('2024-02-29T17:00:00.000Z')
    expect(reportPeriod('all').start).toBeNull()
    for (const value of ['', '2026-13', '2026-00', null, '2026-9', 'x']) expect(() => reportPeriod(value)).toThrow()
  })
  it('sums decimal amounts exactly in minor units', () => {
    expect(buildFinancialReport([row({ amount: '0.10' }), row({ amount: '0.20' })], 'all').totals.expense).toBe(30)
  })
  it('separates savings, transfers and opening balances without double counting', () => {
    const report = buildFinancialReport([
      row({ amount: '1000', analytics_bucket: 'income', transaction_type: 'income', category_type: 'income' }), row(),
      row({ amount: '50', analytics_bucket: 'savings' }), row({ amount: '20', analytics_bucket: 'savings', transaction_type: 'income' }),
      row({ amount: '200', analytics_bucket: 'internal_transfer' }), row({ amount: '200', analytics_bucket: 'internal_transfer', transaction_type: 'income' }),
      row({ amount: '500', analytics_bucket: 'opening_balance', transaction_type: 'income' }),
    ], 'all')
    expect(report.totals).toMatchObject({ income: 100000, expense: 10000, operatingNet: 90000, savingsNet: 3000, afterSavings: 87000, transfer: 20000, opening: 50000 })
    expect(report.ordinaryCount).toBe(2)
  })
  it('never guesses missing/generic/incompatible saved categories from merchant names', () => {
    const report = buildFinancialReport([row({ category_name: null, merchant: 'Gorengan' }), row({ category_name: 'Lainnya' }), row({ category_type: 'income' })], 'all')
    expect(report.unclassified).toBe(3)
    expect(report.categories).toEqual([{ name: 'Belum dikategorikan', type: 'expense', amount: 30000, count: 3 }])
  })
  it('handles empty ledgers without fabricated balances', () => {
    const report = buildFinancialReport([], 'all')
    expect(report.totals.operatingNet).toBe(0)
    expect(report.totals).not.toHaveProperty('closingBalance')
  })
  it('fails instead of exporting truncated or invalid data', () => {
    expect(() => buildFinancialReport(Array(REPORT_LIMIT + 1).fill(row()), 'all')).toThrow('10.000')
    for (const amount of ['NaN', '-1', '0.001', '9007199254740991']) expect(() => buildFinancialReport([row({ amount })], 'all')).toThrow()
  })
})
