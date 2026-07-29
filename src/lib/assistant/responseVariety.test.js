import { describe, expect, it } from 'vitest'
import {
  isNearDuplicateResponse,
  normalizeResponseText,
  selectFreshResponse,
} from './responseVariety'

describe('response variety', () => {
  it('selects a response that was not just used', () => {
    const variants = [
      'Halo! Mau mencatat transaksi?',
      'Hai! Ada yang ingin kamu cek?',
      'Aku siap membantu keuanganmu.',
    ]
    const selected = selectFreshResponse(variants, {
      recentMessages: ['Halo! Mau mencatat transaksi?'],
      seed: 'halo',
    })

    expect(selected).not.toBe(variants[0])
  })

  it('recognizes formatting differences and near duplicate wording', () => {
    expect(normalizeResponseText('  HALO, Kawan!  ')).toBe('halo kawan')
    expect(isNearDuplicateResponse(
      'Aku siap membantu mencatat transaksi keuanganmu hari ini.',
      'Aku siap membantu mencatat transaksi keuanganmu hari ini!'
    )).toBe(true)
  })

  it('falls back to the least recently used response after every variant was used', () => {
    const variants = ['Respons satu.', 'Respons dua.', 'Respons tiga.']
    const selected = selectFreshResponse(variants, {
      recentMessages: ['Respons satu.', 'Respons dua.', 'Respons tiga.'],
      seed: 'rotation',
    })

    expect(selected).toBe('Respons satu.')
  })
})
