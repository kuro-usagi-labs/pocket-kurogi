import { describe, expect, it } from 'vitest'
import { resolveConversationReferences } from './referenceResolver'

const wallets = [
  { id: 'wallet-bca', name: 'BCA' },
  { id: 'wallet-cash', name: 'Tunai' },
]
const memory = [{
  key: 'preferred_wallet',
  value: 'wallet-bca',
  confidence: 0.96,
  updatedAt: '2026-07-30T00:00:00.000Z',
}]

describe('conversation reference resolver', () => {
  it('resolves a usual wallet only in wallet language', () => {
    const result = resolveConversationReferences({
      text: 'catat makan 20rb pakai yang biasa',
      wallets,
      memory,
    })

    expect(result.resolvedText).toContain('BCA')
    expect(result.references).toEqual([
      expect.objectContaining({
        kind: 'wallet',
        resolved: true,
      }),
    ])
  })

  it.each([
    'pengeluaran yang biasa berapa?',
    'yang biasa lebih mahal ya?',
    'tampilkan kategori yang biasa',
  ])('does not rewrite a non-wallet phrase: %s', (text) => {
    const result = resolveConversationReferences({
      text,
      wallets,
      memory,
    })

    expect(result.resolvedText).toBe(text)
    expect(result.references).toEqual([])
  })

  it('allows a direct wallet reference only when dialogue expects a wallet', () => {
    const withoutContext = resolveConversationReferences({
      text: 'yang biasa',
      wallets,
      memory,
    })
    const withContext = resolveConversationReferences({
      text: 'yang biasa',
      wallets,
      memory,
      dialogueState: {
        missingSlots: ['wallet'],
      },
    })

    expect(withoutContext.resolvedText).toBe('yang biasa')
    expect(withContext.resolvedText).toBe('BCA')
  })

  it('does not resolve references from a closed or expired finance draft', () => {
    const closed = resolveConversationReferences({
      text: 'pakai dompet satunya',
      wallets,
      messages: [
        {
          metadata: {
            financeDraft: {
              id: 'draft-1',
              items: [{ walletId: 'wallet-bca' }],
              expiresAt: '2026-07-30T10:30:00.000Z',
            },
          },
        },
        {
          metadata: {
            financeDraftResolved: 'draft-1',
          },
        },
      ],
      now: new Date('2026-07-30T10:00:00.000Z'),
    })
    const expired = resolveConversationReferences({
      text: 'pakai dompet satunya',
      wallets,
      messages: [{
        metadata: {
          financeDraft: {
            id: 'draft-2',
            items: [{ walletId: 'wallet-bca' }],
            expiresAt: '2026-07-30T09:59:00.000Z',
          },
        },
      }],
      now: new Date('2026-07-30T10:00:00.000Z'),
    })

    expect(closed.resolvedText).toBe('pakai dompet satunya')
    expect(expired.resolvedText).toBe('pakai dompet satunya')
  })
})
