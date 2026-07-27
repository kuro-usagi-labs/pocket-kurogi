function formatCurrency(value = 0) {
  return `Rp ${Number(value || 0)}`
}

function formatCategorySummary(categories = []) {
  const items = categories
    .filter((category) => category?.name)
    .slice(0, 3)
    .map((category) => `${category.name}:${formatCurrency(category.amount)}`)

  return items.length > 0 ? items.join(', ') : 'Belum ada'
}

function formatBudgetAlerts(alerts = []) {
  const items = alerts
    .filter((alert) => alert?.name)
    .slice(0, 3)
    .map((alert) => `${alert.name}:${alert.percent.toFixed(0)}%`)

  return items.length > 0 ? items.join(', ') : 'Semua aman'
}

function formatGoalProgress(goals = []) {
  const items = goals
    .filter((goal) => goal?.name)
    .slice(0, 3)
    .map((goal) => goal.progressLabel || goal.name)

  return items.length > 0 ? items.join(', ') : 'Belum ada'
}

export function buildFinancialContextString({
  grandTotalBalance = 0,
  totalBalance = 0,
  totalGoalsBalance = 0,
  totalIncome = 0,
  totalExpense = 0,
  totalSavings = 0,
  netCashflow = 0,
  transferVolume = 0,
  savingsRate = 0,
  topCategories = [],
  topIncomeCategories = [],
  budgetAlerts = [],
  goals = [],
}) {
  return [
    'RINGKASAN KEUANGAN USER:',
    `- Total kekayaan: ${formatCurrency(grandTotalBalance)}`,
    `- Saldo likuid: ${formatCurrency(totalBalance)}`,
    `- Saldo goals: ${formatCurrency(totalGoalsBalance)}`,
    `- Pemasukan tercatat: ${formatCurrency(totalIncome)}`,
    `- Pengeluaran tercatat: ${formatCurrency(totalExpense)}`,
    `- Alokasi tabungan: ${formatCurrency(totalSavings)}`,
    `- Net cashflow: ${formatCurrency(netCashflow)}`,
    `- Volume transfer internal: ${formatCurrency(transferVolume)}`,
    `- Rasio tabungan: ${Number(savingsRate || 0).toFixed(1)}%`,
    `- Top pengeluaran: ${formatCategorySummary(topCategories)}`,
    `- Top pemasukan: ${formatCategorySummary(topIncomeCategories)}`,
    `- Alert budget: ${formatBudgetAlerts(budgetAlerts)}`,
    `- Progres goal aktif: ${formatGoalProgress(goals)}`,
  ].join('\n')
}
