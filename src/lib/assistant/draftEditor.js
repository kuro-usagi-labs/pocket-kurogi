import { parseAmountInput } from '../transactionAmountInput'

export function buildEditedDraft(action, rows, wallets, categories) {
  if (action?.actionType !== 'record_transactions' || action.status !== 'pending' || Date.parse(action.expiresAt) <= Date.now()) throw new Error('Draft sudah tidak aktif. Gunakan konfirmasi terbaru.')
  if (!rows.length || rows.length !== action.payload.items.length) throw new Error('Jumlah transaksi draft berubah. Buka ulang editor.')
  const items = rows.map((row, index) => {
    const amount = parseAmountInput(row.amountText)
    const wallet = wallets.find(entry => entry.id === row.walletId && !entry.is_archived)
    const category = categories.find(entry => entry.id === row.categoryId)
    if (!amount || !wallet || !row.description.trim()) throw new Error(`Lengkapi nominal, dompet, dan catatan transaksi ${index + 1}.`)
    if (!['income', 'expense'].includes(row.transactionType)) throw new Error('Jenis transaksi tidak valid.')
    if (!category || !['both', row.transactionType].includes(category.category_type || 'expense')) throw new Error(`Pilih kategori yang sesuai untuk transaksi ${index + 1}.`)
    return { ...action.payload.items[index], amount, walletId: wallet.id, wallet: wallet.name, categoryId: category.id, category: category.name, transactionType: row.transactionType, description: row.description.trim(), merchant: row.description.trim() }
  })
  return { ...action.payload, items }
}
