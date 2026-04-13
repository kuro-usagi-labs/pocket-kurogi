import { useMemo } from 'react'
import { useWallets } from './useWallets'
import { useTransactions } from './useTransactions'

export function useAdvisor() {
  const { wallets, totalBalance } = useWallets()
  const { transactions, totalIncome, totalExpense } = useTransactions()

  const financialStats = useMemo(() => {
    // 1. Category Breakdown
    const categoryTotals = {}
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount
      })

    const topCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0
      }))

    // 2. Savings Rate
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0
    
    // 3. Wallet Context
    const activeWallets = wallets.map(w => `${w.name}: ${w.current_balance}`).join(', ')

    return {
      totalBalance,
      totalIncome,
      totalExpense,
      savingsRate,
      topCategories,
      activeWallets,
      recentTransactionsCount: transactions.length,
      largestExpense: topCategories[0] || null
    }
  }, [wallets, transactions, totalBalance, totalIncome, totalExpense])

  const getFinancialContextString = () => {
    return `
STATUS KEUANGAN USER SAAT INI:
- Saldo Total: Rp ${financialStats.totalBalance}
- Pemasukan: Rp ${financialStats.totalIncome}
- Pengeluaran: Rp ${financialStats.totalExpense}
- Rasio Tabungan: ${financialStats.savingsRate.toFixed(1)}%
- Dompet Aktif: ${financialStats.activeWallets}
- Pengeluaran Terbesar: ${financialStats.largestExpense ? `${financialStats.largestExpense.name} (Rp ${financialStats.largestExpense.amount})` : 'Belum ada'}
- Top Kategori: ${financialStats.topCategories.slice(0, 3).map(c => `${c.name} (${c.percentage.toFixed(0)}%)`).join(', ')}
    `.trim()
  }

  return { 
    ...financialStats, 
    getContextString: getFinancialContextString 
  }
}
