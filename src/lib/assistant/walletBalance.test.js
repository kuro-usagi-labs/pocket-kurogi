import { describe, expect, it } from 'vitest'
import { runAssistantEngine } from './assistantEngine'
import { orchestrateAssistantMessage } from './unifiedAssistantOrchestrator'
import { buildCorrectedPendingPayload } from './pendingActionManager'
import { buildAssistantCorrectionResponse } from './assistantChatBridge'

const wallets = [{ id: '11111111-1111-4111-8111-111111111111', name: 'Tunai', wallet_type: 'cash', current_balance: 250000 }]
const options = { userId: 'user-1', wallets }
describe('final wallet balance adjustment', () => {
  it('shows wallet, old balance and corrected final balance before reconfirmation', () => {
    const first = runAssistantEngine({ ...options, text: 'edit saldo Tunai menjadi 400k' })
    const corrected = runAssistantEngine({ ...options, text: 'ubah nominalnya 500rb', pendingAction: first.pendingAction, dialogueState: first.dialogueState })
    const response = buildAssistantCorrectionResponse(corrected.pendingAction)
    expect(corrected.command?.payload.targetBalance).toBe(500000)
    expect(response.text).toContain('Tunai')
    expect(response.text).toContain('250.000')
    expect(response.text).toContain('500.000')
    expect(response.card).toMatchObject({ sourceWallet: 'Tunai', expectedBalance: 250000, targetBalance: 500000 })
  })
  it.each(['ganti ke BCA atau Tunai 500rb', 'jangan ubah jadi 500rb', 'ubah menjadi 400rb atau 500rb', 'kalau ubah jadi 500rb', 'ubah jadi -500rb'])('does not rewrite the pending balance for unsafe correction: %s', (text) => {
    const testOptions = { ...options, wallets: [...wallets, { id: '22222222-2222-4222-8222-222222222222', name: 'BCA', wallet_type: 'bank', current_balance: 1000000 }] }
    const first = runAssistantEngine({ ...testOptions, text: 'edit saldo Tunai menjadi 400k' })
    const result = runAssistantEngine({ ...testOptions, text, pendingAction: first.pendingAction, dialogueState: first.dialogueState })
    expect(result.command).toBeNull()
    expect(result.pendingAction?.payload).toEqual(first.pendingAction.payload)
  })
  it.each([['ada ketidaksesuaian saldo, tolong edit saldo di tunai menjadi 400k', 400000], ['ubah saldo Tunai menjadi 0', 0]])('prepares a confirmation for %s', (text, targetBalance) => {
    const result = runAssistantEngine({ ...options, text })
    expect(result.route.intent).toBe('set_wallet_balance')
    expect(result.dialogue.status).toBe('pending_confirmation')
    expect(result.pendingAction.payload).toEqual({ walletId: wallets[0].id, walletName: 'Tunai', expectedBalance: 250000, targetBalance })
    expect(result.response.text).toContain('250.000')
    expect(orchestrateAssistantMessage({ ...options, text }).decision.reason).toBe('canonical_intent_supported')
  })
  it('does not prepare a negative final balance', () => {
    expect(runAssistantEngine({ ...options, text: 'edit saldo Tunai menjadi -400k' }).pendingAction).toBeNull()
  })
  it('corrects a pending final balance to zero without changing its stale-balance guard', () => {
    const action = runAssistantEngine({ ...options, text: 'edit saldo Tunai menjadi 400k' }).pendingAction
    expect(buildCorrectedPendingPayload(action, { text: 'ubah menjadi 0', entities: { amounts: [{ value: 0 }] } })).toMatchObject({ changed: true, payload: { targetBalance: 0, expectedBalance: 250000 } })
  })
  it('rejects a correction with excess precision even when a wallet is provided', () => {
    const action = runAssistantEngine({ ...options, text: 'edit saldo Tunai menjadi 400k' }).pendingAction
    expect(buildCorrectedPendingPayload(action, { text: 'ubah saldo', entities: { amounts: [{ value: 500.001 }], wallets: [{ id: wallets[0].id, name: 'Tunai', wallet: wallets[0] }] } })).toMatchObject({ changed: false, payload: action.payload })
  })
  it('completes a missing target with a zero follow-up', () => {
    const first = runAssistantEngine({ ...options, text: 'edit saldo Tunai' })
    expect(first.dialogue.status).toBe('clarification')
    const result = runAssistantEngine({ ...options, text: '0', dialogueState: first.dialogueState })
    expect(result.pendingAction?.payload.targetBalance).toBe(0)
  })
  it('completes a missing wallet with its current balance for confirmation', () => {
    const first = runAssistantEngine({ ...options, text: 'edit saldo menjadi 400k' })
    const result = runAssistantEngine({ ...options, text: 'Tunai', dialogueState: first.dialogueState })
    expect(result.pendingAction?.payload).toMatchObject({ expectedBalance: 250000, targetBalance: 400000 })
  })
})
