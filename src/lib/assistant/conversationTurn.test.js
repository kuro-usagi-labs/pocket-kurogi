import { expect, it, vi } from 'vitest'
import { resolveConversationTurn } from './conversationTurn'
import { runAssistantEngine } from './assistantEngine'
const wallets = [{ id: '11111111-1111-4111-8111-111111111111', name: 'Tunai', current_balance: 100 }]

it('uses structured slots without rewriting the original text and stages a confirmation', async () => {
  const text = 'barusan cuan 500rb dari jual lukisan, masuk Tunai'
  const turn = await resolveConversationTurn({ text, wallets }, { interpret: async () => ({ intent: 'record_income', amountText: '500rb', description: 'Jual lukisan', wallet: 'Tunai' }) })
  expect(turn.resolvedText).toBe(text)
  expect(turn.frame.intent).toBe('record_income')
  expect(turn.frame.slots.amount).toBe(500000)
  expect(turn.frame.slots.wallet.id).toBe(wallets[0].id)
  expect(turn.frame.action.requiresConfirmation).toBe(true)
  const result = runAssistantEngine({ text, userId: 'user-a', wallets, semanticFrame: turn.frame })
  expect(result.route.intent).toBe('record_income')
  expect(result.pendingAction.status).toBe('pending')
})
it('keeps pending confirmation and negated corrections under deterministic control', async () => {
  const interpret = vi.fn()
  await resolveConversationTurn({ text: 'jangan ubah', wallets, pendingAction: { id: 'a', actionType: 'record_transactions' } }, { interpret })
  expect(interpret).not.toHaveBeenCalled()
})
it('falls back when interpretation is unavailable or invented', async () => {
  const turn = await resolveConversationTurn({ text: 'halo', wallets }, { interpret: async () => { throw new Error('offline') } })
  expect(turn.languageResponse).toBeUndefined()
  const invalid = await resolveConversationTurn({ text: 'halo', wallets }, { interpret: async () => ({ intent: 'record_income', amountText: '500rb' }) })
  expect(invalid.frame.action.mutates).toBe(false)
})
