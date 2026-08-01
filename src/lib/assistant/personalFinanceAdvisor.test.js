import { describe, expect, it } from 'vitest'
import { runAssistantEngine } from './assistantEngine'
import { buildFinancialInsightSnapshot } from './financialInsights'
import {
  buildGoalForecasts,
  composePersonalFinancialAdvice,
  detectRecurringPayments,
  resolveAdvicePreferences,
} from './personalFinanceAdvisor'

const now = new Date('2026-08-01T12:00:00+07:00')
const wallets = [{ id: 'cash', name: 'Tunai', current_balance: 2_000_000, is_archived: false }]
const categories = [{ id: 'food', name: 'Makanan', type: 'expense' }]

function expense({ amount, occurredAt, category = 'Makanan', merchant = 'Kopi', source = 'chat' }) {
  return { type: 'expense', amount, category, merchant, source, occurred_at: occurredAt }
}

describe('personal finance advisor P5', () => {
  it('creates a weekly summary with period, facts, estimates, and advice', () => {
    const transactions = [
      expense({ amount: 150_000, occurredAt: '2026-07-30T08:00:00Z' }),
      { type: 'income', amount: 500_000, category: 'Gaji', occurred_at: '2026-07-28T08:00:00Z' },
      expense({ amount: 100_000, occurredAt: '2026-07-23T08:00:00Z' }),
    ]
    const snapshot = buildFinancialInsightSnapshot({ transactions, now })
    const result = composePersonalFinancialAdvice({
      text: 'ringkasan mingguan saya', snapshot, transactions, wallets, now,
    })

    expect(result.kind).toBe('weekly_summary')
    expect(result.text).toContain('pemasukan')
    expect(result.details).toEqual(expect.arrayContaining([
      expect.stringMatching(/^Fakta — Periode:/u),
      expect.stringMatching(/^Perkiraan —/u),
      expect.stringMatching(/^Saran —/u),
    ]))
  })

  it('routes a natural weekly recap request into the P5 insight flow', () => {
    const result = runAssistantEngine({
      text: 'tolong kasih ringkasan mingguan saya',
      userId: 'user-1', wallets, categories,
      transactions: [expense({ amount: 75_000, occurredAt: '2026-07-30T08:00:00Z' })],
      now,
    })
    expect(result.route.intent).toBe('query_spending_summary')
    expect(result.insight.kind).toBe('weekly_summary')
  })

  it('detects an unusual category increase against four previous weeks', () => {
    const transactions = [
      expense({ amount: 300_000, occurredAt: '2026-07-30T08:00:00Z' }),
      expense({ amount: 40_000, occurredAt: '2026-07-24T08:00:00Z' }),
      expense({ amount: 50_000, occurredAt: '2026-07-17T08:00:00Z' }),
      expense({ amount: 45_000, occurredAt: '2026-07-10T08:00:00Z' }),
      expense({ amount: 45_000, occurredAt: '2026-07-03T08:00:00Z' }),
    ]
    const snapshot = buildFinancialInsightSnapshot({ transactions, now })
    const result = composePersonalFinancialAdvice({
      text: 'pengeluaran apa yang naik tidak biasa?', snapshot, transactions, wallets, now,
    })

    expect(result.kind).toBe('unusual_spending')
    expect(result.text).toContain('Makanan')
    expect(result.details.join(' ')).toContain('empat minggu')
  })

  it('forecasts a goal from actual contribution transactions', () => {
    const goals = [{
      id: 'goal-1', name: 'Nikah', current_amount: 3_000_000,
      target_amount: 12_000_000, deadline: '2027-12-31', status: 'active',
    }]
    const transactions = [
      expense({ amount: 1_000_000, merchant: 'Setoran target Nikah', source: 'goal_contribution', occurredAt: '2026-06-01T08:00:00Z' }),
      expense({ amount: 1_000_000, merchant: 'Setoran target Nikah', source: 'goal_contribution', occurredAt: '2026-07-01T08:00:00Z' }),
      expense({ amount: 1_000_000, merchant: 'Setoran target Nikah', source: 'goal_contribution', occurredAt: '2026-07-30T08:00:00Z' }),
    ]
    const forecasts = buildGoalForecasts(goals, transactions, now)

    expect(forecasts[0].monthlyRate).toBeGreaterThan(900_000)
    expect(forecasts[0].estimatedCompletionAt).toBeTruthy()
    expect(forecasts[0].onTrack).toBe(true)
  })

  it('answers affordability questions without treating them as transactions', () => {
    const result = runAssistantEngine({
      text: 'boleh beli sepatu 300rb?',
      userId: 'user-1',
      wallets,
      categories,
      transactions: [expense({ amount: 100_000, occurredAt: '2026-07-30T08:00:00Z' })],
      now,
    })

    expect(result.route.intent).toBe('financial_advice')
    expect(result.pendingAction).toBeNull()
    expect(result.insight.kind).toBe('affordability')
    expect(result.insight.details).toEqual(expect.arrayContaining([
      expect.stringMatching(/^Fakta —/u),
      expect.stringMatching(/^Perkiraan —/u),
      expect.stringMatching(/^Saran —/u),
    ]))
  })

  it('detects recurring payments and only offers a reminder', () => {
    const transactions = [
      expense({ amount: 150_000, merchant: 'Internet rumah', occurredAt: '2026-06-05T08:00:00Z' }),
      expense({ amount: 150_000, merchant: 'Internet rumah', occurredAt: '2026-07-05T08:00:00Z' }),
    ]
    const recurring = detectRecurringPayments(transactions, now)
    const result = composePersonalFinancialAdvice({
      text: 'cek pembayaran berulang saya', transactions, wallets, now,
    })

    expect(recurring).toHaveLength(1)
    expect(result.kind).toBe('recurring_payments')
    expect(result.offerReminder).toEqual(expect.objectContaining({ description: 'Internet rumah' }))
    expect(result.details.join(' ')).toContain('belum membuat pengingat')
  })

  it('respects disabled advice types and a brief tone stored per account', () => {
    const memory = [{
      key: 'advice_preferences', confidence: 1, value: {
        ...resolveAdvicePreferences(), tone: 'brief', weeklySummary: false,
      },
    }]
    const result = composePersonalFinancialAdvice({
      text: 'ringkasan minggu ini', memory, now,
    })

    expect(result.available).toBe(false)
    expect(result.text).toContain('sedang kamu nonaktifkan')
  })
})
