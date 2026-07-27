import { describe, expect, it } from 'vitest'
import { buildChatQuickActions } from './chatSuggestions'

describe('buildChatQuickActions', () => {
  it('guides first-time users to structure their account before recording money', () => {
    const actions = buildChatQuickActions()

    expect(actions.map((item) => item.id)).toEqual([
      'add-wallet',
      'help',
      'overview',
      'compose',
    ])
    expect(actions[0].navigateTo).toBe('wallets')
  })

  it('suggests transfer when the user already has more than one wallet', () => {
    const actions = buildChatQuickActions({
      wallets: [
        { id: 'wallet-bca', name: 'BCA' },
        { id: 'wallet-dana', name: 'DANA' },
      ],
      transactions: [{ id: 'tx-1', category: 'Makan' }],
      analytics: { netCashflow: 250000 },
    })

    expect(actions.map((item) => item.id)).toEqual([
      'expense',
      'transfer',
      'daily-budget',
      'summary',
    ])
    expect(actions[1].prompt).toContain('transfer 100rb dari BCA ke DANA')
  })

  it('surfaces repeated expense patterns when available', () => {
    const actions = buildChatQuickActions({
      wallets: [{ id: 'wallet-bca', name: 'BCA' }],
      transactions: [
        { id: 'tx-1', type: 'expense', desc: 'Netflix', amount: 65000, category: 'Hiburan' },
        { id: 'tx-2', type: 'expense', desc: 'Netflix', amount: 65000, category: 'Hiburan' },
      ],
      analytics: { netCashflow: 100000 },
    })

    expect(actions[2]).toMatchObject({
      id: 'recurring-expenses',
      prompt: 'cek transaksi berulang saya',
    })
  })

  it('surfaces archived wallets before other secondary actions', () => {
    const actions = buildChatQuickActions({
      wallets: [{ id: 'wallet-bca', name: 'BCA' }],
      archivedWallets: [{ id: 'wallet-arsip', name: 'Jago Lama' }],
      transactions: [{ id: 'tx-1', category: 'Lainnya' }],
      analytics: { netCashflow: 1000 },
    })

    expect(actions[2]).toMatchObject({
      id: 'restore-wallet',
      prompt: 'pulihkan dompet Jago Lama',
    })
  })

  it('switches the last shortcut to cost-saving advice when cashflow is negative', () => {
    const actions = buildChatQuickActions({
      wallets: [{ id: 'wallet-bca', name: 'BCA' }],
      transactions: [
        { id: 'tx-1', category: 'Lainnya' },
        { id: 'tx-2', category: 'Lainnya' },
        { id: 'tx-3', category: 'Lainnya' },
      ],
      analytics: { netCashflow: -120000 },
    })

    expect(actions.map((item) => item.id)).toEqual([
      'expense',
      'income',
      'cleanup-category',
      'advice',
    ])
    expect(actions[2].helper).toBe('3 lainnya')
  })
})
