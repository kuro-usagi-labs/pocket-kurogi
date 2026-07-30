import { describe, expect, it } from 'vitest'
import { buildHistoryPresentation } from './historyPresentation'

describe('history presentation', () => {
  it.each([
    ['Pada, sisa gaji', 'Gaji', 'income', 'Sisa Gaji', 'Gaji'],
    [', beli point coffee', 'Kopi', 'expense', 'Point Coffee', 'Kopi'],
    ['Gaji', 'Gaji', 'income', 'Gaji', 'Pemasukan'],
  ])(
    'normalizes legacy description "%s" consistently',
    (merchant, categoryName, transactionType, title, subtitle) => {
      expect(buildHistoryPresentation({
        merchant,
        categoryName,
        transactionType,
        walletName: 'Tunai',
        source: 'chat',
      })).toMatchObject({
        title,
        subtitle,
      })
    }
  )

  it('keeps structural wallet opening labels intact', () => {
    expect(buildHistoryPresentation({
      merchant: 'Saldo awal Tabungan Bibit',
      transactionType: 'income',
      walletName: 'Tabungan Bibit',
      source: 'wallet_opening_balance',
    })).toMatchObject({
      title: 'Saldo Awal Tabungan Bibit',
      subtitle: 'Saldo awal',
    })
  })
})
