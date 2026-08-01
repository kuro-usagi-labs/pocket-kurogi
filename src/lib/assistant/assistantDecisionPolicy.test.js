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

  it('keeps wallet management behind the temporary legacy adapter', () => {
    const result = decideAssistantHandler({
      frame: frame({
        intent: 'unknown',
        legacyIntent: 'unknown',
        canonicalIntent: 'unknown',
        action: { kind: 'mutation', mutates: true, actionType: 'create_wallet' },
        safety: { blocksWrite: true },
      }),
    })

    expect(result.handler).toBe(ASSISTANT_DECISION_HANDLERS.LEGACY_ADAPTER)
    expect(result.reason).toBe('temporary_legacy_capability')
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

  it.each([
    ['calculate_change', 'tadi bayar pakai uang 50rb kembali 36rb'],
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
