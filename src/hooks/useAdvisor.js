import { useCallback, useMemo } from 'react'
import { buildAIContextString } from '../lib/aiContext'

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
    const topIncomeCategories = Array.isArray(analytics.topIncomeCategories)
      ? analytics.topIncomeCategories.map((category) => ({
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
    const recentActivity = []

    transactions
      .filter((transaction) => transaction.analyticsBucket === 'expense')
      .forEach((transaction) => {
        const key = `${transaction.desc.toLowerCase()}-${transaction.amount}`
        transactionsBySignature[key] = (transactionsBySignature[key] || 0) + 1
        if (transactionsBySignature[key] === 2) {
          potentialSubscriptions.push(transaction.desc)
        }
      })

    transactions.slice(0, 5).forEach((transaction) => {
      recentActivity.push(
        `${transaction.type}:${transaction.desc}:${transaction.amount}:${transaction.category}:${transaction.date}`
      )
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
      topIncomeCategories,
      activeWallets: wallets.map((wallet) => `${wallet.name}: ${wallet.current_balance}`).join(', '),
      goals: goals.map((goal) => {
        const targetAmount = Math.max(Number(goal.target_amount || 0), 1)
        const currentAmount = Number(goal.current_amount || 0)
        return {
          id: goal.id,
          name: goal.name,
          progressPercent: Math.round((currentAmount / targetAmount) * 100),
          progressLabel: `${goal.name} (${Math.round((currentAmount / targetAmount) * 100)}%)`,
        }
      }),
      totalGoalsBalance: goals.reduce((accumulator, goal) => accumulator + Number(goal.current_amount), 0),
      budgetAlerts,
      subscriptions: potentialSubscriptions,
      activeGoals: goals.map((goal) => ({ id: goal.id, name: goal.name })),
      recentActivity,
    }
  }, [analytics, budgets, goals, totalBalance, transactions, wallets])

  const grandTotalBalance = financialStats.totalBalance + financialStats.totalGoalsBalance

  const getAIContextString = useCallback(() => buildAIContextString({
    grandTotalBalance,
    totalBalance: financialStats.totalBalance,
    totalGoalsBalance: financialStats.totalGoalsBalance,
    totalIncome: financialStats.totalIncome,
    totalExpense: financialStats.totalExpense,
    totalSavings: financialStats.totalSavings,
    netCashflow: financialStats.netCashflow,
    transferVolume: financialStats.transferVolume,
    savingsRate: financialStats.savingsRate,
    topCategories: financialStats.topCategories,
    topIncomeCategories: financialStats.topIncomeCategories,
    budgetAlerts: financialStats.budgetAlerts,
    goals: financialStats.goals,
  }), [financialStats, grandTotalBalance])

  return {
    ...financialStats,
    grandTotalBalance,
    getAIContextString,
    getContextString: getAIContextString,
  }
}
