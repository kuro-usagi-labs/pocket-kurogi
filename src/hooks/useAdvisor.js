import { useGoals } from './useGoals'
import { useBudgets } from './useBudgets'

export function useAdvisor() {
  const { wallets, totalBalance } = useWallets()
  const { transactions, totalIncome, totalExpense } = useTransactions()
  const { goals } = useGoals()
  const { budgets } = useBudgets()

  const financialStats = useMemo(() => {
    // 1. Category Breakdown
    const categoryTotals = {}
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount
      })

    // 2. Budget Alert Analysis
    const budgetAlerts = budgets.map(b => {
      const spent = categoryTotals[b.categories?.name] || 0
      const percent = b.monthly_limit > 0 ? (spent / b.monthly_limit) * 100 : 0
      return { name: b.categories?.name, limit: b.monthly_limit, spent, percent }
    }).filter(a => a.percent >= 80)

    const topCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0
      }))

    // 3. Subscription Audit
    const potentialSubscriptions = []
    const txByDesc = {}
    transactions.forEach(t => {
      if (t.type === 'expense') {
        txByDesc[t.desc] = (txByDesc[t.desc] || 0) + 1
      }
    })
    Object.entries(txByDesc).forEach(([desc, count]) => {
      if (count >= 2) potentialSubscriptions.push(desc)
    })

    return {
      totalBalance,
      totalIncome,
      totalExpense,
      savingsRate: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0,
      topCategories,
      activeWallets: wallets.map(w => `${w.name}: ${w.current_balance}`).join(', '),
      goals: goals.map(g => `${g.name} (${Math.round((g.current_amount / g.target_amount) * 100)}% tercapai)`),
      budgetAlerts,
      subscriptions: potentialSubscriptions
    }
  }, [wallets, transactions, totalBalance, totalIncome, totalExpense, goals, budgets])

  const getFinancialContextString = () => {
    return `
STATUS KEUANGAN USER SAAT INI:
- Saldo: Rp ${financialStats.totalBalance}
- Rasio Tabungan: ${financialStats.savingsRate.toFixed(1)}%
- Dompet: ${financialStats.activeWallets}
- Target Tabungan (Goals): ${financialStats.goals.join(', ') || 'Belum ada'}
- Pengeluaran Terbesar: ${financialStats.topCategories[0] ? `${financialStats.topCategories[0].name} (Rp ${financialStats.topCategories[0].amount})` : 'Belum ada'}
- ALERT BUDGET (>80%): ${financialStats.budgetAlerts.map(a => `${a.name}: ${a.percent.toFixed(0)}% used`).join(', ') || 'Semua aman'}
- DETEKSI SUBSCRIPTION: ${financialStats.subscriptions.join(', ') || 'Tidak terdeteksi'}
    `.trim()
  }

  return { 
    ...financialStats, 
    getContextString: getFinancialContextString 
  }
}
