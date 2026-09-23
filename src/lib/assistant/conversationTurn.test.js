import { expect, it, vi } from 'vitest'
import { resolveConversationTurn } from './conversationTurn'
import { runAssistantEngine } from './assistantEngine'
const wallets = [{ id: '11111111-1111-4111-8111-111111111111', name: 'Tunai', current_balance: 100 }]
it('enriches an unknown category without changing understood transaction fields', async () => {
  const text = 'pengeluaran xyzabc 15k tunai'
  const categories = [{ id: 'food', name: 'Makan', category_type: 'expense' }]
  const interpret = vi.fn(async () => ({ intent: 'record_expense', category: 'Makan', description: 'Invented description' }))
  const turn = await resolveConversationTurn({ text, wallets, categories }, { interpret })
  expect(interpret).toHaveBeenCalledOnce()
  expect(turn.frame.slots).toMatchObject({ amount: 15000, description: 'Xyzabc', category: { id: 'food', name: 'Makan' } })
  const result = runAssistantEngine({ text, wallets, categories, userId: 'user-a', semanticFrame: turn.frame })
  expect(result.pendingAction.status).toBe('pending')
  expect(result.pendingAction.payload.items[0].categoryId).toBe('food')
})
it('keeps known categories and provider-independent recording', async () => {
  const categories = [{ id: 'food', name: 'Makan', category_type: 'expense' }]
  const interpret = vi.fn(async () => { throw new Error('quota') })
  const known = await resolveConversationTurn({ text: 'pengeluaran makan 15k tunai', wallets, categories }, { interpret })
  expect(interpret).not.toHaveBeenCalled()
  expect(known.frame.slots.category.name).toBe('Makan')
  const unknown = await resolveConversationTurn({ text: 'pengeluaran xyzabc 15k tunai', wallets, categories }, { interpret })
  expect(unknown.frame.slots.amount).toBe(15000)
})
it.each(['pengeluaran gorengan 15k', 'pengeluaran gorengan 15k tunai'])(
  'understands terse expense input without Gemini: %s', async text => {
    const turn = await resolveConversationTurn({ text, wallets }, { interpret: async () => null })
    expect(turn.frame.intent).toBe('record_expense')
    expect(turn.frame.slots.amount).toBe(15000)
    expect(turn.frame.slots.description.toLowerCase()).toBe('gorengan')
    if (text.endsWith('tunai')) {
      expect(turn.frame.slots.wallet.id).toBe(wallets[0].id)
      const result = runAssistantEngine({ text, wallets, userId: 'user-a', semanticFrame: turn.frame })
      expect(result.pendingAction.status).toBe('pending')
    }
  }
)
it.each(['berapa pengeluaran gorengan 15k?', 'jangan catat pengeluaran gorengan 15k tunai', 'kalau pengeluaran gorengan 15k tunai'])(
  'does not stage a question or negated/hypothetical expense: %s', async text => {
    const turn = await resolveConversationTurn({ text, wallets }, { interpret: async () => null })
    const result = runAssistantEngine({ text, wallets, userId: 'user-a', semanticFrame: turn.frame })
    expect(result.pendingAction).toBeFalsy()
  }
)
it('rejects invalid model theme values', async () => {
  const turn = await resolveConversationTurn({ text: 'tampilannya gelapin dong', wallets }, {
    interpret: async () => ({ intent: 'set_theme', theme: 'invalid' }),
  })
  expect(turn.theme).toBeUndefined()
})

it('applies a validated model theme proposal to the local preference', async () => {
  const interpret = vi.fn().mockResolvedValue({ version: 1, intent: 'set_theme', theme: 'dark' })
  const turn = await resolveConversationTurn({ text: 'tampilannya gelapin dong', wallets }, { interpret })
  expect(interpret).toHaveBeenCalledOnce()
  expect(turn.theme).toBe('dark')
})

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
