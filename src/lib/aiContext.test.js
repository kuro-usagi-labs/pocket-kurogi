import { describe, expect, it } from 'vitest'
import { buildAIContextString } from './aiContext'

describe('buildAIContextString', () => {
  it('keeps the AI context compact and free from raw wallet activity logs', () => {
    const context = buildAIContextString({
      grandTotalBalance: 7500000,
      totalBalance: 5000000,
      totalGoalsBalance: 2500000,
      totalIncome: 8000000,
      totalExpense: 3000000,
      totalSavings: 1000000,
      netCashflow: 4000000,
      transferVolume: 500000,
      savingsRate: 12.5,
      topCategories: [
        { name: 'Makan', amount: 900000 },
        { name: 'Transport', amount: 450000 },
      ],
      topIncomeCategories: [{ name: 'Gaji', amount: 8000000 }],
      budgetAlerts: [{ name: 'Makan', percent: 92 }],
      goals: [{ name: 'Liburan Jepang', progressLabel: 'Liburan Jepang (35%)' }],
    })

    expect(context).toContain('RINGKASAN KEUANGAN USER')
    expect(context).toContain('Top pengeluaran: Makan:Rp 900000')
    expect(context).toContain('Progres goal aktif: Liburan Jepang (35%)')
    expect(context).not.toContain('AKTIVITAS TERBARU')
    expect(context).not.toContain('Dompet:')
  })
})
