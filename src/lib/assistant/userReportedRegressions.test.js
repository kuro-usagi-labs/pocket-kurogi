import { expect, it, vi } from 'vitest'
import { resolveConversationTurn } from './conversationTurn'
import { runAssistantEngine } from './assistantEngine'
import { extractMoneyEntities } from './moneyExtractor'
import { extractAmountFromText } from '../chatLearning'
const wallets = [{ id: 'cash', name: 'Tunai', current_balance: 1000000 }, { id: 'bca', name: 'BCA', current_balance: 1000000 }]
async function process(text, extra = {}) {
  const input = { text, wallets, userId: 'owner', ...extra }
  const interpret = vi.fn(async () => null)
  const turn = await resolveConversationTurn(input, { interpret })
  return runAssistantEngine({ ...input, semanticFrame: turn.frame })
}
it.each(['500', '500 perak', '500 rupiah', 'Rp500'])('keeps literal rupiah in a staged transaction: %s', async amount => {
  const result = await process(`pengeluaran plastik kresek ${amount} bca`)
  expect(result.pendingAction?.payload.items[0].amount).toBe(500)
  expect(result.pendingAction.payload.items[0].description).toBe('Plastik kresek')
})
it.each([['500k', 500000], ['500rb', 500000], ['500 ribu', 500000], ['0,5k', 500], ['2,860,097', 2860097]])('keeps explicit magnitude: %s', async (amount, expected) => {
  expect((await process(`pengeluaran plastik kresek ${amount} bca`)).pendingAction?.payload.items[0].amount).toBe(expected)
})
it('uses literal amounts consistently in learning and word-number normalization', () => {
  expect(extractAmountFromText('kresek 500')).toBe(500)
  expect(extractMoneyEntities('pengeluaran lima ratus rupiah')[0].value).toBe(500)
})
it.each(['pengeluaran perbaiki hp my pacar 175k tunai', 'uang saya, pengeluaran perbaiki hp my pacar 175k tunai', 'bayar makan untuk ibu 20k tunai'])('does not confuse beneficiary with payer: %s', async text => {
  expect((await process(text)).pendingAction?.payload.items[0].transactionType).toBe('expense')
})
it('parses the exact four-line list without losing items', async () => {
  const result = await process('makan pecel lele 55k tunai\nperbaiki hp my pacar 175k tunai\nmilku 4k tunai\nrokok black matcha 17k tunai')
  expect(result.pendingAction?.payload.items.map(item => item.amount)).toEqual([55000, 175000, 4000, 17000])
  expect(result.pendingAction.payload.items.every(item => item.walletId === 'cash')).toBe(true)
})
it.each(['teman beli kopi 20k tunai', 'pengeluaran kopi 20k tunai dibayar teman', 'jangan pengeluaran kopi 20k tunai', 'pengeluaran kopi 20k tunai?'])('still refuses third-party payments, negations and questions: %s', async text => {
  expect((await process(text)).pendingAction).toBeFalsy()
})
it('retains a real ownership clarification and restages it after a payer reply', async () => {
  const blocked = await process('teman beli kopi 20k tunai')
  expect(blocked.dialogueState.missingSlots).toContain('payer')
  const resumed = await process('ya saya lah', { dialogueState: blocked.dialogueState })
  expect(resumed.pendingAction?.payload.items[0].amount).toBe(20000)
})
it('understands gorengan and continues the wallet question without Gemini', async () => {
  const first = await process('pengeluaran gorengan 15k')
  const next = await process('tunai', { dialogueState: first.dialogueState })
  expect(next.pendingAction?.payload.items[0].amount).toBe(15000)
})
it.each(['iya benar kok', 'catat semua', 'iya catat'])('confirms an actual bulk draft: %s', async text => {
  const first = await process('makan 55k tunai\nmilku 4k tunai')
  const next = await process(text, { pendingAction: first.pendingAction, dialogueState: first.dialogueState })
  expect(next.command?.type).toBe('confirm_pending_action')
})
it.each(['iya tapi jangan catat', 'iya bukan 55k', 'catat semua kecuali milku'])('does not confuse corrections with confirmation: %s', async text => {
  const first = await process('makan 55k tunai\nmilku 4k tunai')
  const next = await process(text, { pendingAction: first.pendingAction, dialogueState: first.dialogueState })
  expect(next.command?.type).not.toBe('confirm_pending_action')
})
it('does not resurrect expired ownership drafts', async () => {
  const blocked = await process('teman beli kopi 20k tunai')
  const state = { ...blocked.dialogueState, expiresAt: '2020-01-01T00:00:00Z' }
  expect((await process('uang saya', { dialogueState: state })).pendingAction).toBeFalsy()
})
it.each(['makan 55k tunai\nmilku tunai', 'makan 55k tunai\ntransfer 10k tunai', 'makan 55k tunai\njangan rokok 17k tunai'])('never drops an unsafe or incomplete unlabelled line: %s', async text => {
  expect((await process(text)).pendingAction).toBeFalsy()
})
it('keeps implicit income separate from an unlabelled expense', async () => {
  const result = await process('gaji 500k bca\nmilku 4k tunai')
  expect(result.pendingAction?.payload.items.map(item => item.transactionType)).toEqual(['income', 'expense'])
})
it('does not ask to confirm invented drafts through Gemini', async () => {
  const interpret = vi.fn()
  const result = await resolveConversationTurn({ text: 'catat semua', wallets }, { interpret })
  expect(interpret).not.toHaveBeenCalled()
  expect(result.languageResponse.text).toContain('Belum ada daftar transaksi aktif')
})
