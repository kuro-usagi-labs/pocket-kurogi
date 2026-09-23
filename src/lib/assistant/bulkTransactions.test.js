import { expect, it } from 'vitest'
import { runAssistantEngine } from './assistantEngine'
import { resolveConversationTurn } from './conversationTurn'
const wallets = [{ id: 'cash', name: 'Tunai', current_balance: 100000 }]
const text = 'pengeluaran 15k jajan\npemasukan 10k kerja sapu\npengeluaran 8k kopi'
it('preserves the list through the chat orchestrator without Gemini replacement', async () => {
  const turn = await resolveConversationTurn({ text, wallets }, { interpret: async () => { throw new Error('Must not interpret bulk') } })
  expect(turn.frame.intent).toBe('record_multiple_transactions')
  expect(turn.frame.slots.items).toHaveLength(3)
})
it.each(['pengeluaran 15k jajan tunai\npemasukan kerja sapu',
  'pengeluaran 15k jajan tunai\njangan pemasukan 10k kerja sapu',
  Array(21).fill('pengeluaran 1k kopi tunai').join('\n')])('blocks incomplete, negated, or oversized lists', text => {
  expect(runAssistantEngine({ text, wallets, userId: 'owner' }).pendingAction).toBeFalsy()
})
it('keeps mixed multiline items and asks for a shared wallet', () => {
  const result = runAssistantEngine({ text, wallets, userId: 'owner' })
  expect(result.route.intent).toBe('record_multiple_transactions')
  expect(result.pendingAction).toBeFalsy()
  expect(result.dialogueState.collectedSlots.items.map(item => [item.transactionType, item.amount, item.description.toLowerCase()]))
    .toEqual([['expense', 15000, 'jajan'], ['income', 10000, 'kerja sapu'], ['expense', 8000, 'kopi']])
  const followup = runAssistantEngine({ text: 'Tunai', wallets, userId: 'owner', dialogueState: result.dialogueState })
  expect(followup.pendingAction.payload.items).toHaveLength(3)
  expect(followup.pendingAction.payload.items.every(item => item.walletId === 'cash')).toBe(true)
})
it('stages one confirmation when each line names its wallet', () => {
  const result = runAssistantEngine({ text: text.split('\n').map(line => `${line} tunai`).join('\n'), wallets, userId: 'owner' })
  expect(result.pendingAction.payload.items.map(item => [item.transactionType, item.amount, item.walletId]))
    .toEqual([['expense',15000,'cash'], ['income',10000,'cash'], ['expense',8000,'cash']])
})
it('never silently drops an incomplete line', () => {
  const result = runAssistantEngine({ text: 'pengeluaran 15k jajan tunai\npemasukan kerja sapu', wallets, userId: 'owner' })
  expect(result.pendingAction).toBeFalsy()
})
