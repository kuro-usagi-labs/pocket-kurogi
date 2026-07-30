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
        acknowledgment: false,
        interpretation: true,
        confirmation: true,
        warning: false,
      },
      constraints: {
        preserveFinancialFacts: true,
        neverClaimWriteBeforeConfirmation: true,
      },
    })
  })

  it('does not ask for more detail when a low-confidence action is already complete', () => {
    const plan = planAssistantResponse({
      intent: 'record_income',
      status: 'pending_confirmation',
      confidence: 0.55,
      hasPendingAction: true,
    })

    expect(plan.tone).toBe('friendly')
    expect(plan.structure).toMatchObject({
      acknowledgment: false,
      interpretation: true,
      warning: false,
      clarification: false,
      confirmation: true,
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

  it('asks one concise follow-up without repeating acknowledgments or warnings', () => {
    const plan = planAssistantResponse({
      intent: 'record_income',
      status: 'clarification',
      confidence: 0.9,
      hasClarification: true,
    })
    const components = applyResponsePlan({
      acknowledgment: 'Pemasukannya sudah aku pahami.',
      interpretation: 'Pemasukan Rp72.000 melalui Tunai.',
      warning: 'Aku perlu satu detail.',
      clarification: 'Uang itu diterima untuk apa?',
      nextSuggestion: 'Tidak perlu mengulang semuanya.',
    }, plan)

    expect(components).toMatchObject({
      acknowledgment: null,
      interpretation: 'Pemasukan Rp72.000 melalui Tunai.',
      warning: null,
      clarification: 'Uang itu diterima untuk apa?',
      nextSuggestion: null,
    })
  })
})
