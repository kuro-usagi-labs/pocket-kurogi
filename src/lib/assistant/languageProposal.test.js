import { expect, it } from 'vitest'
import { validateLanguageProposal } from './languageProposal'

const context = { wallets: [{ id: 'w', name: 'Tunai', current_balance: 100 }], goals: [] }
it.each([
  [{ intent: 'record_income', amountText: '900rb' }, 'gaji 500rb'],
  [{ intent: 'record_income', amountText: '500rb' }, 'jangan catat gaji 500rb'],
  [{ intent: 'confirm_pending_action' }, 'iya'],
  [{ intent: 'record_income', amountText: '500rb', wallet: 'Asing' }, 'gaji 500rb ke Asing'],
])('rejects unsupported, ungrounded or unsafe proposals', (proposal, text) => {
  expect(() => validateLanguageProposal({ proposal, text, context })).toThrow()
})
it('maps zero balance and server-owned reference directly into slots', () => {
  const p = validateLanguageProposal({ proposal: { intent: 'set_wallet_balance', amountText: '0', wallet: 'Tunai', walletId: 'foreign', expectedBalance: 900 }, text: 'ubah saldo Tunai menjadi 0', context })
  expect(p.slots).toEqual({ wallet: { id: 'w', name: 'Tunai' }, expectedBalance: 100, targetBalance: 0 })
  expect(p.missingFields).toEqual([])
})
it('preserves evidence value and asks for missing wallet instead of guessing', () => {
  const p = validateLanguageProposal({ proposal: { intent: 'record_income', amountText: '2,860,097', description: 'Gaji' }, text: 'aku baru mendapatkan gaji 2,860,097', context })
  expect(p.slots).toMatchObject({ amount: 2860097, transactionType: 'income', description: 'Gaji' })
  expect(p.missingFields).toContain('wallet')
})
