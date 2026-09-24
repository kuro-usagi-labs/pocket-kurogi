import { describe, expect, it } from 'vitest'
import { buildEditedDraft } from './draftEditor'

const wallets = [{ id: 'cash', name: 'Tunai' }]
const categories = [{ id: 'food', name: 'Makan', category_type: 'expense' }, { id: 'pay', name: 'Gaji', category_type: 'income' }]
const action = { actionType: 'record_transactions', status: 'pending', expiresAt: '2099-01-01', payload: { items: [{ clientItemId: 'one', occurredAt: '2026-09-25' }, { clientItemId: 'two' }] } }
const rows = [{ amountText: '500 perak', walletId: 'cash', categoryId: 'food', description: 'Plastik', transactionType: 'expense' }, { amountText: '2.860.097', walletId: 'cash', categoryId: 'pay', description: 'Gaji', transactionType: 'income' }]
describe('structured transaction draft correction', () => {
  it('preserves row identities and dates while correcting each amount', () => {
    const edited = buildEditedDraft(action, rows, wallets, categories)
    expect(edited.items[0]).toMatchObject({ amount: 500, clientItemId: 'one', occurredAt: '2026-09-25', wallet: 'Tunai' })
    expect(edited.items[1]).toMatchObject({ amount: 2860097, category: 'Gaji', transactionType: 'income' })
    expect(action.payload.items[0].amount).toBeUndefined()
  })
  it('rejects category/type mismatches and unavailable wallets', () => {
    expect(() => buildEditedDraft(action, [{ ...rows[0], categoryId: 'pay' }, rows[1]], wallets, categories)).toThrow('kategori')
    expect(() => buildEditedDraft(action, rows, [], categories)).toThrow('Lengkapi')
  })
  it('rejects expired drafts and missing rows', () => {
    expect(() => buildEditedDraft({ ...action, expiresAt: '2000-01-01' }, rows, wallets, categories)).toThrow('aktif')
    expect(() => buildEditedDraft(action, rows.slice(1), wallets, categories)).toThrow('Jumlah')
  })
})
