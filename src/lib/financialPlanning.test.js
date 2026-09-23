import { describe, expect, it } from 'vitest'
import {
  buildPlanningCalendar,
  calculateIncomeAllocation,
  expandFinancialSchedule,
  finalizePlanningSummary,
  resolveReminderPreferences,
  simulateSavingsPlan,
  summarizePlanningCalendar,
} from './financialPlanning'

describe('financial planning P6', () => {
  it.each([
    ['2026-01-31', ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']],
    ['2026-01-30', ['2026-01-30', '2026-02-28', '2026-03-30', '2026-04-30']],
    ['2026-01-28', ['2026-01-28', '2026-02-28', '2026-03-28', '2026-04-28']],
    ['2024-01-31', ['2024-01-31', '2024-02-29', '2024-03-31', '2024-04-30']],
  ])('preserves original monthly day across February: %s', (date, expected) => {
    const year = Number(date.slice(0, 4))
    expect(expandFinancialSchedule({ id: 's', is_active: true, next_due_date: date, cadence: 'monthly', amount: 1 }, { from: new Date(year, 0, 1), days: 120 }).map(x => x.date)).toEqual(expected)
  })
  it('projects old active monthly schedules without exhausting the loop guard', () => {
    expect(expandFinancialSchedule({ id: 's', is_active: true, next_due_date: '1980-01-31', cadence: 'monthly', amount: 1 }, { from: new Date(2026, 0, 1), days: 60 }).map(x => x.date)).toEqual(['2026-01-31', '2026-02-28'])
  })
  it('preserves the anchor across a year boundary', () => {
    expect(expandFinancialSchedule({ id: 's', is_active: true, next_due_date: '2025-12-31', cadence: 'monthly', amount: 1 }, { from: new Date(2025, 11, 1), days: 91 }).map(x => x.date)).toEqual(['2025-12-31', '2026-01-31', '2026-02-28'])
  })
  it('projects weekly and monthly schedules without creating transactions', () => {
    const weekly = expandFinancialSchedule({
      id: 'weekly', title: 'Setoran nikah', schedule_type: 'goal_contribution',
      amount: 500_000, cadence: 'weekly', next_due_date: '2026-08-03',
      reminder_enabled: true, is_active: true,
    }, { from: new Date('2026-08-01'), days: 31 })
    const monthly = expandFinancialSchedule({
      id: 'monthly', title: 'Internet', schedule_type: 'bill',
      amount: 300_000, cadence: 'monthly', next_due_date: '2026-08-31',
      reminder_enabled: true, is_active: true,
    }, { from: new Date('2026-08-01'), days: 62 })

    expect(weekly).toHaveLength(5)
    expect(monthly.map((item) => item.date)).toEqual(['2026-08-31', '2026-09-30'])
  })

  it('combines global reminder preferences with each schedule', () => {
    const preferences = resolveReminderPreferences([
      { reminder_type: 'bill', enabled: false },
    ])
    const calendar = buildPlanningCalendar([{
      id: 'bill', title: 'Listrik', schedule_type: 'bill', amount: 200_000,
      cadence: 'once', next_due_date: '2026-08-05', reminder_enabled: true,
      is_active: true,
    }], { preferences, from: new Date('2026-08-01'), days: 30 })

    expect(calendar[0].reminderActive).toBe(false)
  })

  it('summarizes future cashflow separately from the real ledger', () => {
    const summary = finalizePlanningSummary(summarizePlanningCalendar([
      { scheduleType: 'income', amount: 5_000_000, reminderActive: true },
      { scheduleType: 'bill', amount: 1_000_000, reminderActive: true },
      { scheduleType: 'goal_contribution', amount: 500_000, reminderActive: false },
    ]))
    expect(summary).toMatchObject({
      income: 5_000_000, outflow: 1_500_000, goalContribution: 500_000,
      net: 3_500_000, activeReminders: 2,
    })
  })

  it('requires salary allocation to total exactly 100 percent', () => {
    const valid = calculateIncomeAllocation({
      monthlyIncome: 10_000_000, needsPercent: 50, savingsPercent: 25,
      debtPercent: 10, freePercent: 15,
    })
    const invalid = calculateIncomeAllocation({
      monthlyIncome: 10_000_000, needsPercent: 50, savingsPercent: 25,
      debtPercent: 10, freePercent: 20,
    })
    expect(valid.valid).toBe(true)
    expect(valid.amounts).toEqual({
      needs: 5_000_000, savings: 2_500_000, debt: 1_000_000, free: 1_500_000,
    })
    expect(invalid.valid).toBe(false)
  })

  it('simulates target timing with an inspectable formula and no mutation', () => {
    const result = simulateSavingsPlan({
      targetAmount: 70_000_000,
      currentAmount: 10_000_000,
      contributionAmount: 500_000,
      cadence: 'monthly',
      startDate: new Date('2026-08-01'),
    })
    expect(result).toMatchObject({
      valid: true, remaining: 60_000_000, contributionCount: 120,
      mutatesTransactions: false,
    })
    expect(result.formula).toContain('120 setoran')
    expect(result.estimatedCompletionAt).toContain('2036-08-01')
  })
})
