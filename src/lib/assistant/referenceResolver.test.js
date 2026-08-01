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

  it('ignores legacy chat drafts and reads only the active backend pending action', () => {
    const legacyMetadata = resolveConversationReferences({
      text: 'pakai dompet satunya',
      wallets,
      messages: [{
        metadata: {
          financeDraft: {
            id: 'legacy-draft',
            items: [{ walletId: 'wallet-bca' }],
          },
        },
      }],
    })
    const canonical = resolveConversationReferences({
      text: 'pakai dompet satunya',
      wallets,
      pendingAction: {
        id: 'pending-1',
        status: 'pending_confirmation',
        payload: {
          items: [{ walletId: 'wallet-bca' }],
        },
      },
    })

    expect(legacyMetadata.resolvedText).toBe('pakai dompet satunya')
    expect(canonical.resolvedText).toContain('Tunai')
  })
})
