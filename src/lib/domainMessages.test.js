import { describe, expect, it } from 'vitest'
import { getTransactionDeletionDialogCopy } from './domainMessages'

const formatRupiah = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

describe('getTransactionDeletionDialogCopy', () => {
  it('explains that deleting an expense returns money to the wallet', () => {
    const copy = getTransactionDeletionDialogCopy(
      {
        title: 'Kopi',
        type: 'expense',
        amount: 25000,
        wallet: 'BCA',
        category: 'Makan',
      },
      formatRupiah
    )

    expect(copy.title).toBe('Hapus "Kopi"?')
    expect(copy.paragraphs).toContain('Pengeluaran: Rp 25.000 (Makan).')
    expect(copy.paragraphs).toContain('Saldo BCA akan dikembalikan Rp 25.000.')
    expect(copy.tone).toBe('danger')
  })

  it('explains that undoing an income subtracts money from the wallet', () => {
    const copy = getTransactionDeletionDialogCopy(
      {
        title: 'Gaji',
        type: 'income',
        amount: 5000000,
        wallet: 'Mandiri',
        category: 'Gaji',
      },
      formatRupiah,
      { mode: 'undo' }
    )

    expect(copy.title).toBe('Batalkan "Gaji"?')
    expect(copy.confirmLabel).toBe('Batalkan')
    expect(copy.paragraphs).toContain('Pemasukan: Rp 5.000.000 (Gaji).')
    expect(copy.paragraphs).toContain('Saldo Mandiri akan dikurangi Rp 5.000.000.')
  })
})
