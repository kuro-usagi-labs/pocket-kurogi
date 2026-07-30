import { describe, expect, it } from 'vitest'
import {
  applyResponsePlan,
  planAssistantResponse,
} from './responsePlanner'

describe('assistant response planner', () => {
  it('keeps confirmations explicit for financial mutations', () => {
    const plan = planAssistantResponse({
      intent: 'record_expense',
      status: 'pending_confirmation',
      confidence: 0.96,
      hasPendingAction: true,
    })

    expect(plan).toMatchObject({
      tone: 'friendly',
      structure: {
        acknowledgment: true,
        interpretation: true,
        confirmation: true,
      },
      constraints: {
        preserveFinancialFacts: true,
        neverClaimWriteBeforeConfirmation: true,
      },
    })
  })

  it('uses an empathetic supportive plan for worried users', () => {
    const plan = planAssistantResponse({
      intent: 'financial_advice',
      emotion: { emotion: 'worried' },
      hasInsight: true,
    })

    expect(plan.tone).toBe('empathetic')
    expect(plan.verbosity).toBe('supportive')
    expect(plan.structure.empathy).toBe(true)
    expect(plan.structure.insight).toBe(true)
  })

  it('removes optional suggestions for concise communication', () => {
    const plan = planAssistantResponse({
      intent: 'calculate_change',
      communicationStyle: 'concise',
    })
    const components = applyResponsePlan({
      acknowledgment: 'Oke.',
      interpretation: 'Belanjanya Rp14.000.',
      nextSuggestion: 'Mau dicatat?',
    }, plan)

    expect(components.interpretation).toContain('Rp14.000')
    expect(components.nextSuggestion).toBeNull()
  })
})
