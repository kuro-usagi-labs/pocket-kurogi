import { describe, expect, it } from 'vitest'
import { runAssistantEngine } from './assistantEngine'
import { buildAssistantExecutionResponse, shouldHandleAssistantEngineResult } from './assistantChatBridge'
import { buildFinancialInsightSnapshot } from './financialInsights'
import { composeFinancialQueryResult } from './financialInsights'
import { resolveQueryPeriod } from './queryPeriod'

const now = new Date(2026, 8, 23, 12)
const transactions = [
  { type: 'expense', amount: 25000, occurred_at: new Date(2026, 8, 22, 12).toISOString() },
  { type: 'expense', amount: 300000, occurred_at: new Date(2026, 8, 3, 12).toISOString() },
]

describe('conversation audit regressions', () => {
  it.each([
    ['hari ini', 23, 24],
    ['kemarin', 22, 23],
    ['7 hari terakhir', 17, 24],
    ['minggu ini', 21, 28],
    ['2026-09-03 sampai 2026-09-22', 3, 23],
  ])('resolves inclusive calendar dates with exclusive end for %s', (text, start, end) => {
    const period = resolveQueryPeriod(text, now)
    expect(new Date(period.startAt).getDate()).toBe(start)
    expect(new Date(period.endAt).getDate()).toBe(end)
  })
  it('filters wallet and date together, excluding the next midnight', () => {
    const response = composeFinancialQueryResult({ intent: 'query_expenses', text: 'kemarin', now, slots: { wallet: { id: 'a' } }, transactions: [
      { type: 'expense', amount: 100, wallet_id: 'a', occurred_at: new Date(2026, 8, 22, 0).toISOString() },
      { type: 'expense', amount: 200, wallet_id: 'b', occurred_at: new Date(2026, 8, 22, 12).toISOString() },
      { type: 'expense', amount: 300, wallet_id: 'a', occurred_at: new Date(2026, 8, 23, 0).toISOString() },
    ] })
    expect(response.text).toMatch(/Rp\s*100\./u)
  })
  it.each(['hi', 'halo', 'hello', 'makasih', 'kamu bisa apa', 'kamu siapa', 'apa kabar'])('delivers a useful non-mutating reply for %s', (text) => {
    const result = runAssistantEngine({ text, now })
    expect(result.route.intent).toBe('general_chat')
    expect(shouldHandleAssistantEngineResult(result)).toBe(true)
    expect(result.response.text.length).toBeGreaterThan(20)
    expect(result.pendingAction).toBeNull()
  })
  it('filters yesterday instead of returning the whole month', () => {
    const result = runAssistantEngine({ text: 'Berapa pengeluaran kemarin', transactions, now })
    expect(result.response.text).toMatch(/kemarin Rp\s*25\.000/u)
    expect(result.response.text).not.toContain('325.000')
    const list = runAssistantEngine({ text: 'Lihat transaksi kemarin', transactions, now })
    expect(list.response.card.details).toHaveLength(1)
  })
  it('compares month-to-date with the equivalent prior month window', () => {
    const snapshot = buildFinancialInsightSnapshot({ now, transactions: [
      ...transactions,
      { type: 'expense', amount: 325000, occurred_at: new Date(2026, 7, 22, 12).toISOString() },
      { type: 'expense', amount: 999999, occurred_at: new Date(2026, 7, 31, 12).toISOString() },
    ] })
    expect(snapshot.comparison.expenseChangePercent).toBe(0)
  })
  it('preserves the backend replay flag outside nested data', () => {
    const response = buildAssistantExecutionResponse({ id: 'a', actionType: 'transfer_money', payload: {} }, { replayed: true, data: {} })
    expect(response.metadata.idempotentReplay).toBe(true)
    expect(response.text).toContain('sudah pernah')
  })
})
