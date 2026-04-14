import { useMemo } from 'react'

export function useAdvisor({
  wallets = [],
  totalBalance = 0,
  transactions = [],
  analytics = {},
  goals = [],
  budgets = [],
}) {
  const financialStats = useMemo(() => {
    const totalIncome = Number(analytics.totalIncome || 0)
    const totalExpense = Number(analytics.totalExpense || 0)
    const totalSavings = Number(analytics.totalSavings || 0)
    const topCategories = Array.isArray(analytics.topExpenseCategories)
      ? analytics.topExpenseCategories.map((category) => ({
          name: category.name,
          amount: Number(category.amount || 0),
          percentage: Number(category.percentage || 0),
        }))
      : []
    const categoryTotals = Object.fromEntries(
      topCategories.map((category) => [category.name, Number(category.amount || 0)])
    )

    const budgetAlerts = budgets
      .map((budget) => {
        const spent = categoryTotals[budget.categories?.name] || 0
        const percent = budget.monthly_limit > 0 ? (spent / budget.monthly_limit) * 100 : 0
        return { name: budget.categories?.name, limit: budget.monthly_limit, spent, percent }
      })
      .filter((alert) => alert.percent >= 80)

    const potentialSubscriptions = []
    const transactionsBySignature = {}

    transactions
      .filter((transaction) => transaction.analyticsBucket === 'expense')
      .forEach((transaction) => {
        const key = `${transaction.desc.toLowerCase()}-${transaction.amount}`
        transactionsBySignature[key] = (transactionsBySignature[key] || 0) + 1
        if (transactionsBySignature[key] === 2) {
          potentialSubscriptions.push(transaction.desc)
        }
      })

    return {
      totalBalance,
      totalIncome,
      totalExpense,
      totalSavings,
      netCashflow: Number(analytics.netCashflow || 0),
      transferVolume: Number(analytics.transferVolume || 0),
      savingsRate: totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0,
      topCategories,
      activeWallets: wallets.map((wallet) => `${wallet.name}: ${wallet.current_balance}`).join(', '),
      goals: goals.map(
        (goal) => `${goal.name} (${Math.round((goal.current_amount / goal.target_amount) * 100)}% tercapai)`
      ),
      totalGoalsBalance: goals.reduce((accumulator, goal) => accumulator + Number(goal.current_amount), 0),
      budgetAlerts,
      subscriptions: potentialSubscriptions,
      activeGoals: goals.map((goal) => ({ id: goal.id, name: goal.name })),
    }
  }, [analytics, budgets, goals, totalBalance, transactions, wallets])

  const grandTotalBalance = financialStats.totalBalance + financialStats.totalGoalsBalance

  const getFinancialContextString = () => `
STATUS KEUANGAN USER SAAT INI:
- Total Kekayaan (Wallet + Tabungan): Rp ${grandTotalBalance}
- Saldo Likuid (Dompet): Rp ${financialStats.totalBalance}
- Saldo Milestone (Goals): Rp ${financialStats.totalGoalsBalance}
- Pemasukan Tercatat: Rp ${financialStats.totalIncome}
- Pengeluaran Tercatat: Rp ${financialStats.totalExpense}
- Alokasi Tabungan: Rp ${financialStats.totalSavings}
- Net Cashflow: Rp ${financialStats.netCashflow}
- Rasio Tabungan: ${financialStats.savingsRate.toFixed(1)}%
- Dompet: ${financialStats.activeWallets}
- Target Tabungan (Goals): ${financialStats.goals.join(', ') || 'Belum ada'}
- Pengeluaran Terbesar: ${financialStats.topCategories[0] ? `${financialStats.topCategories[0].name} (Rp ${financialStats.topCategories[0].amount})` : 'Belum ada'}
- ALERT BUDGET (>80%): ${financialStats.budgetAlerts.map((alert) => `${alert.name}: ${alert.percent.toFixed(0)}% used`).join(', ') || 'Semua aman'}
- DETEKSI SUBSCRIPTION: ${financialStats.subscriptions.join(', ') || 'Tidak terdeteksi'}
  `.trim()

  return {
    ...financialStats,
    grandTotalBalance,
    getContextString: getFinancialContextString,
  }
}
