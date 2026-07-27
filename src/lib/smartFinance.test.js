import { describe, expect, it } from 'vitest'
import { buildSmartFinanceReply, detectSmartFinanceQuery } from './smartFinance'

const wallets = [
  { id: 'bca', name: 'BCA', current_balance: 2000000 },
  { id: 'cash', name: 'Tunai', current_balance: 300000 },
]

const goals = [
  { id: 'laptop', name: 'Laptop', current_amount: 3000000, target_amount: 6000000 },
]

const formatRupiah = (value) => `Rp${Number(value).toLocaleString('id-ID')}`

describe('smart finance rules', () => {
  it('checks affordability against a named wallet', () => {
    const query = detectSmartFinanceQuery('saldo BCA cukup untuk beli sepatu 750rb?', wallets, goals)
    expect(query).toMatchObject({ type: 'affordability_query', amount: 750000, walletId: 'bca' })

    const reply = buildSmartFinanceReply({
      query,
      wallets,
      totalBalance: 2300000,
      formatRupiah,
    })
    expect(reply).toContain('cukup')
    expect(reply).toContain('Rp1.250.000')
  })

  it('calculates a conservative daily budget', () => {
    const query = detectSmartFinanceQuery('budget harian saya berapa?', wallets, goals)
    const reply = buildSmartFinanceReply({
      query,
      totalBalance: 3100000,
      formatRupiah,
      now: new Date('2026-07-01T00:00:00+07:00'),
    })

    expect(query.type).toBe('daily_budget_query')
    expect(reply).toContain('Rp80.000 per hari')
  })

  it('projects when a savings goal will be reached', () => {
    const query = detectSmartFinanceQuery(
      'kapan target laptop tercapai kalau nabung 500rb per bulan?',
      wallets,
      goals
    )
    const reply = buildSmartFinanceReply({ query, goals, formatRupiah, now: new Date('2026-07-01') })

    expect(query).toMatchObject({
      type: 'goal_projection_query',
      goalId: 'laptop',
      monthlyContribution: 500000,
    })
    expect(reply).toContain('6 bulan')
  })

  it('finds repeated expenses locally', () => {
    const query = detectSmartFinanceQuery('cek transaksi berulang saya', wallets, goals)
    const reply = buildSmartFinanceReply({
      query,
      transactions: [
        { type: 'expense', desc: 'Netflix', amount: 65000 },
        { type: 'expense', desc: 'Netflix', amount: 65000 },
        { type: 'expense', desc: 'Makan', amount: 25000 },
      ],
      formatRupiah,
    })

    expect(reply).toContain('Netflix')
    expect(reply).toContain('2 kali')
  })
})
