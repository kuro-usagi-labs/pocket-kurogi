import { describe, expect, it } from 'vitest'
import {
  buildMemoryProposalResolutionResponse,
  buildMemoryProposalResponse,
  classifyMemoryProposalReply,
  getPendingMemoryProposal,
} from './memoryProposal'

const proposal = {
  id: 'memory-proposal:message-1',
  status: 'proposed',
  expiresAt: '2026-07-30T10:15:00.000Z',
  memories: [{ key: 'preferred_wallet' }],
  displayItems: [{
    key: 'preferred_wallet',
    value: 'wallet-bca',
    displayValue: 'BCA',
  }],
}

describe('assistant memory proposal dialogue', () => {
  it.each(['iya', 'oke', 'simpan ya', 'setuju'])(
    'accepts a strict confirmation reply: %s',
    (text) => {
      expect(classifyMemoryProposalReply(text)).toBe('confirm')
    }
  )

  it.each(['batal', 'jangan', 'nggak', 'ngga usah', 'ga usah'])(
    'accepts a strict cancellation reply: %s',
    (text) => {
      expect(classifyMemoryProposalReply(text)).toBe('cancel')
    }
  )

  it.each(['iya catat transaksi', 'oke buat dompet', 'mungkin', 'kenapa?'])(
    'does not consume an unrelated or compound message: %s',
    (text) => {
      expect(classifyMemoryProposalReply(text)).toBeNull()
    }
  )

  it('only resolves a fresh proposal from the latest bot turn', () => {
    const messages = [{
      sender: 'bot',
      metadata: { assistantMemoryProposal: proposal },
    }]

    expect(getPendingMemoryProposal(
      messages,
      new Date('2026-07-30T10:05:00.000Z')
    )).toEqual(proposal)
    expect(getPendingMemoryProposal(
      messages,
      new Date('2026-07-30T10:16:00.000Z')
    )).toBeNull()
    expect(getPendingMemoryProposal([
      ...messages,
      { sender: 'user', text: 'bahas yang lain' },
      { sender: 'bot', text: 'Baik.' },
    ], new Date('2026-07-30T10:05:00.000Z'))).toBeNull()
  })

  it('uses transparent proposal and resolution copy', () => {
    expect(buildMemoryProposalResponse(proposal)).toEqual(
      expect.objectContaining({
        text: expect.stringContaining('dompet default BCA'),
        intentStatus: 'needs_confirmation',
        metadata: expect.objectContaining({
          confirmationMode: 'binary',
        }),
      })
    )
    expect(buildMemoryProposalResolutionResponse(proposal, 'confirm').text)
      .toContain('sudah kusimpan')
  })
})
