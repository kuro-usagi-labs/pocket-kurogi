import { describe, expect, it } from 'vitest'
import {
  ASSISTANT_DECISION_HANDLERS,
  decideAssistantHandler,
} from './assistantDecisionPolicy'

function frame(overrides = {}) {
  return {
    intent: 'record_expense',
    legacyIntent: 'record_expense',
    canonicalIntent: 'record_expense',
    action: { kind: 'mutation', mutates: true, actionType: 'record_transactions' },
    safety: { blocksWrite: false },
    ...overrides,
  }
}

describe('assistant decision policy', () => {
  it('returns a final no-fallback decision for canonical finance intents', () => {
    expect(decideAssistantHandler({ frame: frame() })).toEqual(
      expect.objectContaining({
        handler: ASSISTANT_DECISION_HANDLERS.CANONICAL,
        final: true,
        allowFallback: false,
      })
    )
  })

  it('routes recognized wallet management through the canonical pipeline', () => {
    const result = decideAssistantHandler({
      frame: frame({
        intent: 'create_wallet',
        legacyIntent: 'create_wallet',
        canonicalIntent: 'create_wallet',
        action: { kind: 'mutation', mutates: true, actionType: 'create_wallet' },
        safety: { blocksWrite: false },
      }),
    })

    expect(result.handler).toBe(ASSISTANT_DECISION_HANDLERS.CANONICAL)
    expect(result.reason).toBe('canonical_intent_supported')
  })

  it('never lets local state override an executable backend pending action', () => {
    const result = decideAssistantHandler({
      frame: frame(),
      canonicalPendingAction: { id: 'canonical' },
      legacyPendingAction: { id: 'legacy' },
    })

    expect(result.handler).toBe(ASSISTANT_DECISION_HANDLERS.CANONICAL)
    expect(result.stateConflict).toBe(true)
  })

  it('routes explicit memory approval without invoking a finance parser', () => {
    const result = decideAssistantHandler({
      frame: frame({
        intent: 'general_chat',
        legacyIntent: 'general_chat',
        canonicalIntent: 'general_conversation',
        action: { kind: 'conversation', mutates: false },
      }),
      pendingMemoryProposal: { id: 'proposal' },
      memoryProposalDecision: 'confirm',
    })

    expect(result).toMatchObject({
      handler: ASSISTANT_DECISION_HANDLERS.MEMORY_CONFIRMATION,
      memoryProposalDecision: 'confirm',
      allowFallback: false,
    })
  })

  it('handles change calculation without a legacy fallback', () => {
    const result = decideAssistantHandler({
      frame: frame({
        intent: 'calculate_change',
        legacyIntent: 'calculate_change',
        canonicalIntent: 'calculate_change',
        utterance: { normalized: 'tadi bayar pakai uang 50rb kembali 36rb' },
        action: { kind: 'calculation', mutates: false },
      }),
    })
    expect(result.handler).toBe(ASSISTANT_DECISION_HANDLERS.CANONICAL)
  })

  it.each([
    ['record_multiple_transactions', 'beli bensin 20rb dan makan 10rb pakai uang 50rb'],
    ['financial_advice', 'uangku tinggal 200rb buat sebulan, cukup tidak?'],
  ])('keeps %s in the compatibility adapter until contextual parity exists', (intent, text) => {
    const result = decideAssistantHandler({
      frame: frame({
        intent,
        legacyIntent: intent,
        canonicalIntent: intent,
        utterance: { normalized: text },
        entities: { amounts: [{ value: 50_000 }, { value: 36_000 }] },
        action: { kind: 'conversation', mutates: false },
      }),
    })

    expect(result.handler).toBe(ASSISTANT_DECISION_HANDLERS.LEGACY_ADAPTER)
    expect(result.allowFallback).toBe(false)
  })
})
