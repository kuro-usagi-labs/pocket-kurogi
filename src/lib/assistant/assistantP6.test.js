import { describe, expect, it } from 'vitest'
import { runAssistantEngine } from './assistantEngine'

const goal = {
  id: 'goal-nikah',
  name: 'Nikah',
  target_amount: 70_000_000,
  current_amount: 10_000_000,
  status: 'active',
}

describe('assistant P6 planning intelligence', () => {
  it('simulates a recurring contribution against a named goal without staging a mutation', () => {
    const result = runAssistantEngine({
      text: 'kalau aku nabung 500rb per bulan, kapan cukup untuk nikah?',
      userId: 'user-1',
      goals: [goal],
      now: new Date('2026-08-01T12:00:00+07:00'),
    })

    expect(result.route.intent).toBe('financial_advice')
    expect(result.insight.kind).toBe('savings_simulation')
    expect(result.insight.simulation).toMatchObject({
      contributionAmount: 500_000,
      contributionCount: 120,
      mutatesTransactions: false,
    })
    expect(result.pendingAction).toBeNull()
    expect(result.insight.details.join(' ')).toMatch(/tidak ada transaksi/iu)
  })

  it('answers upcoming schedule questions from inspectable planning data', () => {
    const result = runAssistantEngine({
      text: 'tagihan terdekat yang akan jatuh tempo apa?',
      userId: 'user-1',
      schedules: [{
        id: 'schedule-1',
        title: 'Internet',
        schedule_type: 'bill',
        amount: 350_000,
        cadence: 'monthly',
        next_due_date: '2026-08-05',
        reminder_enabled: true,
        is_active: true,
      }],
      reminderPreferences: { bill: true },
      now: new Date('2026-08-01T12:00:00+07:00'),
    })

    expect(result.route.intent).toBe('financial_advice')
    expect(result.insight).toMatchObject({ available: true, kind: 'planning_calendar' })
    expect(result.insight.text).toMatch(/Internet/iu)
    expect(result.pendingAction).toBeNull()
  })
})
