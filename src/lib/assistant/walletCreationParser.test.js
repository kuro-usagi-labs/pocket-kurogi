import { describe, expect, it } from 'vitest'
import {
  extractWalletCreationDetails,
  parseWalletNameReply,
} from './walletCreationParser'

describe('wallet creation conversation parser', () => {
  it.each([
    ['BCA', 'BCA', 'bank'],
    ['namanya GoPay', 'GoPay', 'e_wallet'],
    ['dompet uang harian aja', 'Uang Harian', 'cash'],
    ['rekening BRI', 'BRI', 'bank'],
  ])('accepts one safe wallet-name answer: %s', (text, name, walletType) => {
    expect(parseWalletNameReply(text)).toEqual({
      walletName: name,
      walletType,
    })
  })

  it.each([
    'BCA dan OVO',
    'BCA atau OVO',
    'BCA saldo 500rb',
    'jangan BCA',
    'BCA?',
  ])('rejects an ambiguous wallet-name answer: %s', (text) => {
    expect(parseWalletNameReply(text).walletName).toBeNull()
  })

  it('keeps creation intent and name extraction separate', () => {
    expect(extractWalletCreationDetails('tolong buat dompet')).toEqual(
      expect.objectContaining({
        isCreationRequest: true,
        walletName: null,
      })
    )
  })
})
