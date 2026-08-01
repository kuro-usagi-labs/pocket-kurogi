import { describe, expect, it } from 'vitest'
import {
  attachAssistantUnderstanding,
  orchestrateAssistantMessage,
} from './unifiedAssistantOrchestrator'
import { runAssistantEngine } from './assistantEngine'

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
    })
    expect(result.frame).toMatchObject({
      version: 2,
      canonicalIntent: 'record_expense',
    })
    expect(result.decision).toMatchObject({
      handler: 'canonical_pipeline',
      final: true,
      allowFallback: false,
    })
  })

  it('routes wallet management and teaching through canonical handlers', () => {
    const walletCreation = orchestrateAssistantMessage({
      text: 'buatkan dompet BCA',
      wallets: [],
    })

    expect(walletCreation.decision.handler).toBe('canonical_pipeline')
    expect(walletCreation.frame.action).toMatchObject({
      kind: 'mutation',
      actionType: 'create_wallet',
      mutates: true,
      requiresConfirmation: true,
    })
    expect(orchestrateAssistantMessage({
      text: 'ajari Kurogi bahwa ngopi berarti kategori Makan',
      categories,
    }).decision.handler).toBe('canonical_learning_rule')
  })

  it('routes transfers into a savings goal to the canonical pipeline', () => {
    const result = orchestrateAssistantMessage({
      text: 'pindahkan 1jt tabungan bibit ke simpanan nikah',
      wallets: [{
        id: 'wallet-bibit',
        name: 'Tabungan Bibit',
        current_balance: 2_000_000,
      }],
      goals: [{
        id: 'goal-nikah',
        name: 'Simpanan Nikah',
        current_amount: 0,
        target_amount: 20_000_000,
        status: 'active',
      }],
    })

    expect(result.frame.intent).toBe('deposit_goal')
    expect(result.frame.slots).toMatchObject({
      amount: 1_000_000,
      goal: { id: 'goal-nikah' },
      sourceWallet: { id: 'wallet-bibit' },
    })
  })

  it('captures explicit preferences independently from the selected engine', () => {
    const style = orchestrateAssistantMessage({
      text: 'Mulai sekarang jawab lebih ringkas ya',
    })
    const wallet = orchestrateAssistantMessage({
      text: 'BCA adalah dompet utama saya mulai sekarang',
      wallets,
    })

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

  it('records the canonical handler that actually produced the response', () => {
    const orchestration = orchestrateAssistantMessage({
      text: 'catat makan 20rb dari BCA',
      wallets,
      categories,
    })
    const response = attachAssistantUnderstanding(
      { text: 'canonical response' },
      orchestration,
      { actualEngine: 'canonical-pipeline' }
    )

    expect(response.metadata).toMatchObject({
      assistantEngine: 'canonical-pipeline',
      assistantUnderstanding: {
        engine: 'canonical-pipeline',
      },
    })
  })

  it('chooses exactly one final handler and prioritizes backend pending state', () => {
    const result = orchestrateAssistantMessage({
      text: 'iya konfirmasi',
      wallets,
      pendingAction: { id: 'backend-action' },
    })

    expect(result.decision).toMatchObject({
      handler: 'canonical_pipeline',
      reason: 'canonical_pending_action',
      final: true,
      allowFallback: false,
    })
  })

  it('extracts teaching rules without invoking a legacy parser', () => {
    const result = orchestrateAssistantMessage({
      text: 'kalau aku bilang kantor, pakai dompet BCA',
      wallets,
      categories,
    })

    expect(result.decision).toMatchObject({
      handler: 'canonical_learning_rule',
      reason: 'explicit_learning_rule',
      allowFallback: false,
    })
    expect(result.learningRuleCandidate).toMatchObject({
      type: 'teach_wallet_rule',
      keyword: 'kantor',
      walletId: 'wallet-bca',
      source: 'utterance',
    })
  })

  it('applies learned wallet and category rules inside the canonical semantic frame', () => {
    const result = orchestrateAssistantMessage({
      text: 'catat pengeluaran ngopi kantor 20rb',
      wallets,
      categories,
      categoryRules: [{
        keyword: 'ngopi',
        category_id: 'cat-food',
        usage_count: 3,
      }],
      walletRules: [{
        keyword: 'kantor',
        wallet_id: 'wallet-bca',
        usage_count: 2,
      }],
    })

    expect(result.decision.handler).toBe('canonical_pipeline')
    expect(result.frame.slots).toMatchObject({
      amount: 20_000,
      wallet: { id: 'wallet-bca', name: 'BCA' },
      category: { id: 'cat-food', name: 'Makan' },
    })
    expect(result.frame.entities.wallets[0]).toMatchObject({
      source: 'learned_rule',
      matchedKeyword: 'kantor',
    })
    expect(result.frame.entities.categories[0]).toMatchObject({
      source: 'learned_rule',
      matchedKeyword: 'ngopi',
    })
  })

  it('discloses when a remembered wallet changes the interpretation', () => {
    const result = orchestrateAssistantMessage({
      text: 'catat pengeluaran makan 20rb',
      wallets,
      categories,
      memory: [{
        key: 'preferred_wallet',
        value: 'wallet-bca',
        confidence: 0.96,
        source: 'explicit',
      }],
    })

    expect(result.frame.entities.wallets[0]).toMatchObject({
      id: 'wallet-bca',
      source: 'memory',
    })
    const engine = runAssistantEngine({
      text: result.resolvedText,
      userId: 'memory-disclosure-user',
      wallets,
      categories,
      memory: [{
        key: 'preferred_wallet',
        value: 'wallet-bca',
        confidence: 0.96,
        source: 'explicit',
      }],
      semanticFrame: result.frame,
    })
    expect(engine.memoryInfluence).toMatchObject({ type: 'preferred_wallet' })
    expect(engine.response.text).toContain('tersimpan sebagai dompet utamamu')
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
