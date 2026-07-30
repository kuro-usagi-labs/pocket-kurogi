import { describe, expect, it } from 'vitest'
import {
  attachAssistantUnderstanding,
  orchestrateAssistantMessage,
} from './unifiedAssistantOrchestrator'

const wallets = [
  { id: 'wallet-bca', name: 'BCA', current_balance: 1_000_000 },
  { id: 'wallet-cash', name: 'Tunai', current_balance: 200_000 },
]
const categories = [
  { id: 'cat-food', name: 'Makan', category_type: 'expense' },
]

describe('unified assistant orchestrator', () => {
  it('builds one semantic frame for a safe financial command', () => {
    const result = orchestrateAssistantMessage({
      text: 'Tolong catat makan 20rb dari BCA',
      wallets,
      categories,
    })

    expect(result.frame).toMatchObject({
      intent: 'record_expense',
      dialogueAct: 'command',
      action: {
        kind: 'mutation',
        requiresConfirmation: true,
      },
      slots: {
        amount: 20_000,
        wallet: { id: 'wallet-bca', name: 'BCA' },
      },
      safety: { safe: true },
      engine: 'deterministic',
    })
  })

  it('routes wallet management and user teaching to the local specialist', () => {
    const walletCreation = orchestrateAssistantMessage({
      text: 'buatkan dompet BCA',
      wallets: [],
    })

    expect(walletCreation.preferredEngine).toBe('local')
    expect(walletCreation.frame.action).toMatchObject({
      kind: 'mutation',
      actionType: 'create_wallet',
      mutates: true,
      requiresConfirmation: true,
    })
    expect(orchestrateAssistantMessage({
      text: 'ajari Kurogi bahwa ngopi berarti kategori Makan',
      categories,
    }).preferredEngine).toBe('local')
  })

  it('captures explicit preferences independently from the selected engine', () => {
    const style = orchestrateAssistantMessage({
      text: 'Mulai sekarang jawab lebih ringkas ya',
    })
    const wallet = orchestrateAssistantMessage({
      text: 'BCA adalah dompet utama saya mulai sekarang',
      wallets,
    })

    expect(style.preferredEngine).toBe('local')
    expect(['general_chat', 'unknown']).toContain(style.frame.intent)
    expect(style.frame.action.kind).toBe('conversation')
    expect(style.memoryCandidates).toEqual([
      expect.objectContaining({
        key: 'preferred_communication_style',
        value: 'concise',
        source: 'explicit',
      }),
    ])
    expect(wallet.memoryCandidates).toEqual([
      expect.objectContaining({
        key: 'preferred_wallet',
        value: 'wallet-bca',
        source: 'explicit',
      }),
    ])
  })

  it('does not confuse a keyword teaching rule with a global preference', () => {
    const result = orchestrateAssistantMessage({
      text: 'Kalau aku bilang kantor, pakai dompet BCA',
      wallets,
    })

    expect(result.preferredEngine).toBe('local')
    expect(result.memoryCandidates).toEqual([])
  })

  it.each([
    'Apakah BCA dompet utama saya?',
    'BCA bukan dompet utama saya',
    'Kalau nanti BCA jadi dompet utama saya',
  ])('never proposes memory from unsafe or non-declarative context: %s', (text) => {
    const result = orchestrateAssistantMessage({ text, wallets })

    expect(result.memoryCandidates).toEqual([])
  })

  it('treats a one-off detail request as local wording, not durable memory', () => {
    const result = orchestrateAssistantMessage({
      text: 'Tolong jelaskan detail saldo BCA',
      wallets,
    })

    expect(result.memoryCandidates).toEqual([])
  })

  it('records the engine that actually produced the response', () => {
    const orchestration = orchestrateAssistantMessage({
      text: 'catat makan 20rb dari BCA',
      wallets,
      categories,
    })
    const response = attachAssistantUnderstanding(
      { text: 'fallback local' },
      orchestration,
      { actualEngine: 'local' }
    )

    expect(response.metadata).toMatchObject({
      assistantEngine: 'local',
      assistantPreferredEngine: 'deterministic',
      assistantUnderstanding: {
        engine: 'local',
        preferredEngine: 'deterministic',
      },
    })
  })

  it('resolves an explicit preferred-wallet reference without guessing', () => {
    const result = orchestrateAssistantMessage({
      text: 'catat makan 20rb pakai yang biasa',
      wallets,
      categories,
      memory: [{
        key: 'preferred_wallet',
        value: 'wallet-bca',
        confidence: 0.96,
        updatedAt: '2026-07-30T00:00:00.000Z',
      }],
    })

    expect(result.resolvedText).toContain('BCA')
    expect(result.frame.references[0]).toMatchObject({
      kind: 'wallet',
      resolved: true,
      target: { id: 'wallet-bca' },
    })
  })

  it('keeps hypothetical and third-party statements blocked from writes', () => {
    const hypothetical = orchestrateAssistantMessage({
      text: 'kalau besok aku beli sepatu 500rb dari BCA',
      wallets,
      categories,
    })
    const thirdParty = orchestrateAssistantMessage({
      text: 'temanku beli makan 20rb dari BCA, catat',
      wallets,
      categories,
    })

    expect(hypothetical.frame.safety.blocksWrite).toBe(true)
    expect(thirdParty.frame.safety.blocksWrite).toBe(true)
  })
})
