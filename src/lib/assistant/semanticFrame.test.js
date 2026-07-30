import { describe, expect, it } from 'vitest'
import {
  buildAssistantSemanticFrame,
  reconcileSemanticFrameWithLocalAnalysis,
} from './semanticFrame'

describe('assistant semantic frame local reconciliation', () => {
  it('recognizes a local wallet mutation before execution', () => {
    const frame = buildAssistantSemanticFrame({
      text: 'tolong buatkan dompet bernama BCA',
    })

    expect(frame.action).toMatchObject({
      kind: 'mutation',
      actionType: 'create_wallet',
      mutates: true,
    })
  })

  it('allows a safe local write only with an explicit write decision', () => {
    const frame = buildAssistantSemanticFrame({
      text: 'tolong buatkan dompet bernama BCA',
    })
    const allowed = reconcileSemanticFrameWithLocalAnalysis(frame, {
      type: 'create_wallet',
      name: 'BCA',
      writeDecision: 'commit',
    })
    const denied = reconcileSemanticFrameWithLocalAnalysis(frame, {
      type: 'create_wallet',
      name: 'BCA',
      writeDecision: 'review',
    })

    expect(allowed.executionAllowed).toBe(true)
    expect(allowed.frame.action).toMatchObject({
      actionType: 'create_wallet',
      writeDecision: 'commit',
      requiresConfirmation: false,
    })
    expect(denied.executionAllowed).toBe(false)
    expect(denied.frame.safety).toMatchObject({
      blocksWrite: true,
      safe: false,
    })
  })

  it('blocks a question even when the local parser marks it executable', () => {
    const frame = buildAssistantSemanticFrame({
      text: 'bisa buatkan dompet BCA?',
    })
    const result = reconcileSemanticFrameWithLocalAnalysis(frame, {
      type: 'create_wallet',
      name: 'BCA',
      writeDecision: 'commit',
    })

    expect(frame.safety.blocksWrite).toBe(true)
    expect(result.executionAllowed).toBe(false)
    expect(result.reason).toBe('semantic_safety_blocked')
  })

  it('preserves follow-up confirmation metadata for destructive wallet actions', () => {
    const frame = buildAssistantSemanticFrame({
      text: 'hapus dompet BCA',
      wallets: [{ id: 'wallet-bca', name: 'BCA' }],
    })
    const result = reconcileSemanticFrameWithLocalAnalysis(frame, {
      type: 'delete_wallet',
      walletId: 'wallet-bca',
      writeDecision: 'commit',
    })

    expect(result.executionAllowed).toBe(true)
    expect(result.frame.action.requiresConfirmation).toBe(true)
  })
})
