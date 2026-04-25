const PERIOD_LABELS = {
  today: 'hari ini',
  this_week: 'minggu ini',
  this_month: 'bulan ini',
  last_30_days: '30 hari terakhir',
  all_time: 'seluruh data',
}

export function resolveAnalyticsTimeframe(period = 'all_time', now = new Date()) {
  const current = new Date(now)
  const key = PERIOD_LABELS[period] ? period : 'all_time'

  if (key === 'all_time') {
    return {
      key,
      label: PERIOD_LABELS[key],
      startAt: null,
      endAt: null,
    }
  }

  let startAt

  if (key === 'today') {
    startAt = new Date(current.getFullYear(), current.getMonth(), current.getDate())
  } else if (key === 'this_week') {
    const day = current.getDay()
    const diffToMonday = day === 0 ? 6 : day - 1
    startAt = new Date(current.getFullYear(), current.getMonth(), current.getDate() - diffToMonday)
  } else if (key === 'this_month') {
    startAt = new Date(current.getFullYear(), current.getMonth(), 1)
  } else {
    startAt = new Date(current)
    startAt.setDate(startAt.getDate() - 29)
    startAt.setHours(0, 0, 0, 0)
  }

  return {
    key,
    label: PERIOD_LABELS[key],
    startAt: startAt.toISOString(),
    endAt: current.toISOString(),
  }
}

export function buildAnalyticsReply({
  query,
  snapshot,
  formatRupiah,
  goals = [],
}) {
  const {
    totalIncome = 0,
    totalExpense = 0,
    totalSavings = 0,
    netCashflow = 0,
    transferVolume = 0,
    topExpenseCategories = [],
    topIncomeCategories = [],
  } = snapshot || {}

  const periodLabel = query?.periodLabel || PERIOD_LABELS[query?.period] || PERIOD_LABELS.all_time
  const totalTracked = totalIncome + totalExpense + Math.abs(totalSavings) + transferVolume

  if (totalTracked <= 0) {
    return `Belum ada data untuk ${periodLabel}. Catat transaksi dulu, lalu tanya lagi.`
  }

  const nextGoal = goals
    .filter((goal) => goal.status !== 'completed')
    .sort((left, right) => {
      const leftRatio = Number(left.current_amount || 0) / Math.max(Number(left.target_amount || 1), 1)
      const rightRatio = Number(right.current_amount || 0) / Math.max(Number(right.target_amount || 1), 1)
      return rightRatio - leftRatio
    })[0]

  const topExpense = topExpenseCategories[0] || null
  const topIncome = topIncomeCategories[0] || null

  switch (query?.metric) {
    case 'total_income':
      return `Pemasukan tercatat untuk ${periodLabel} adalah ${formatRupiah(totalIncome)}.${formatPrimaryCategory({
        label: 'Sumber terbesar',
        category: topIncome,
        formatRupiah,
      })}`
    case 'total_expense':
      return `Pengeluaran inti untuk ${periodLabel} adalah ${formatRupiah(totalExpense)}.${formatPrimaryCategory({
        label: 'Kategori terbesar',
        category: topExpense,
        formatRupiah,
      })}`
    case 'total_savings':
      return totalSavings >= 0
        ? `Alokasi tabungan untuk ${periodLabel} tercatat ${formatRupiah(totalSavings)}.${formatGoalHint(
            nextGoal,
            formatRupiah
          )}`
        : `Dana tabungan bersih untuk ${periodLabel} berkurang ${formatRupiah(Math.abs(totalSavings))} karena ada pengembalian dari target yang ditutup.`
    case 'net_cashflow':
      return `Net cashflow untuk ${periodLabel} adalah ${formatSignedCurrency(netCashflow, formatRupiah)}. ${buildCashflowComment(
        netCashflow,
        totalIncome,
        totalExpense,
        totalSavings
      )}`
    case 'transfer_volume':
      return `Volume transfer internal untuk ${periodLabel} adalah ${formatRupiah(transferVolume)}. Nilai ini tidak saya hitung sebagai pemasukan atau pengeluaran utama supaya analytics tidak dobel.`
    case 'top_income':
      return buildCategoryRankingReply({
        intro: `Sumber pemasukan terbesar untuk ${periodLabel}:`,
        categories: topIncomeCategories,
        formatRupiah,
        emptyMessage: `Belum ada kategori pemasukan yang cukup untuk ${periodLabel}.`,
      })
    case 'top_expense':
      return buildCategoryRankingReply({
        intro: `Sumber pengeluaran terbesar untuk ${periodLabel}:`,
        categories: topExpenseCategories,
        formatRupiah,
        emptyMessage: `Belum ada kategori pengeluaran yang cukup untuk ${periodLabel}.`,
      })
    default:
      return [
        `Ringkasan ${periodLabel}:`,
        `Pemasukan ${formatRupiah(totalIncome)}`,
        `Pengeluaran inti ${formatRupiah(totalExpense)}`,
        `Tabungan ${formatRupiah(totalSavings)}`,
        `Net cashflow ${formatSignedCurrency(netCashflow, formatRupiah)}`,
        topExpense
          ? `Pengeluaran paling berat masih di ${topExpense.name} sebesar ${formatRupiah(topExpense.amount)} (${formatPercentage(topExpense.percentage)}).`
          : 'Belum ada kategori pengeluaran dominan di periode ini.',
        nextGoal
          ? `Target yang paling dekat tercapai saat ini adalah ${nextGoal.name}, progresnya ${formatGoalProgress(nextGoal)}.`
          : 'Belum ada target tabungan aktif yang perlu dipantau.',
      ].join('\n')
  }
}

export function buildAdviceReply({
  query,
  snapshot,
  budgets = [],
  goals = [],
  transactions = [],
  formatRupiah,
}) {
  const {
    totalIncome = 0,
    totalExpense = 0,
    totalSavings = 0,
    netCashflow = 0,
    transferVolume = 0,
    topExpenseCategories = [],
    topIncomeCategories = [],
  } = snapshot || {}

  const periodLabel = query?.periodLabel || PERIOD_LABELS[query?.period] || PERIOD_LABELS.all_time
  const trackedTotal = totalIncome + totalExpense + Math.abs(totalSavings)

  if (trackedTotal <= 0) {
    return `Saya belum punya cukup data untuk memberi strategi ${periodLabel}. Coba catat beberapa pemasukan atau pengeluaran dulu, lalu tanya lagi.`
  }

  const focus = query?.focus || 'overall'
  const topExpense = topExpenseCategories[0] || null
  const topIncome = topIncomeCategories[0] || null
  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0
  const budgetAlerts = buildBudgetAlerts({ budgets, topExpenseCategories })
  const nextGoal = findNextGoal(goals)
  const recentExpenseExamples = findRecentExpenseExamples({
    transactions,
    categoryName: topExpense?.name,
  })
  const actionItems = []

  if (netCashflow < 0) {
    actionItems.push('Tahan komitmen baru dulu sampai arus kas kembali positif.')
  }

  if (focus === 'expense' || focus === 'overall' || focus === 'budget') {
    if (topExpense) {
      const share = resolveCategoryShare(topExpense, totalExpense)
      const expenseLine = recentExpenseExamples.length > 0
        ? `Pangkas ${topExpense.name} dulu, terutama transaksi seperti ${formatShortList(recentExpenseExamples)}.`
        : `Pangkas ${topExpense.name} dulu sekitar 10-15% karena ini pos paling berat di ${periodLabel}.`
      actionItems.push(expenseLine)

      if (share >= 45) {
        actionItems.push(`${topExpense.name} sendirian sudah memakan ${formatPercentage(share)} dari pengeluaran inti, jadi ini area tercepat untuk dibenahi.`)
      }
    }

    const budgetAlert = query?.period === 'this_month' || query?.period === 'today' || query?.period === 'this_week'
      ? budgetAlerts[0]
      : null

    if (budgetAlert) {
      const remaining = Math.max(budgetAlert.limit - budgetAlert.spent, 0)
      actionItems.push(
        `Budget ${budgetAlert.category} sudah ${budgetAlert.percent.toFixed(0)}% terpakai, sisa ruang aman tinggal ${formatRupiah(remaining)}.`
      )
    }
  }

  if (focus === 'savings' || focus === 'overall') {
    if (totalIncome > 0 && savingsRate < 10) {
      const suggestedTopUp = Math.max(Math.ceil(((totalIncome * 0.1) - totalSavings) / 1000) * 1000, 0)
      if (suggestedTopUp > 0) {
        actionItems.push(
          `Naikkan alokasi tabungan minimal ${formatRupiah(suggestedTopUp)} lagi agar rasio sisihannya mendekati 10% dari pemasukan.`
        )
      }
    } else if (nextGoal) {
      const remaining = Math.max(Number(nextGoal.target_amount || 0) - Number(nextGoal.current_amount || 0), 0)
      actionItems.push(`Kalau ada surplus, arahkan ke target ${nextGoal.name}. Sisa yang perlu dikejar ${formatRupiah(remaining)}.`)
    }
  }

  if (focus === 'income' || focus === 'overall') {
    if (topIncome) {
      const concentration = resolveCategoryShare(topIncome, totalIncome)
      actionItems.push(
        concentration >= 60
          ? `Pemasukan paling besar masih bertumpu di ${topIncome.name}, jadi jangan tambah komitmen tetap sebelum sumber ini benar-benar stabil.`
          : `Jaga ritme pemasukan dari ${topIncome.name} karena sejauh ini itu masih sumber terbesar kamu.`
      )
    } else if (totalIncome <= 0) {
      actionItems.push('Belum ada pemasukan tercatat di periode ini, jadi fokus utama sebaiknya menjaga pengeluaran tetap ringan.')
    }
  }

  if (focus === 'overall' && netCashflow > 0 && totalSavings <= 0) {
    actionItems.push('Arus kas masih positif, tapi belum banyak yang diamankan ke tabungan. Sisihkan surplusnya sebelum habis ke pengeluaran variabel.')
  }

  if (focus === 'overall' && transferVolume > totalExpense && transferVolume > 0) {
    actionItems.push('Transfer internal sedang tinggi. Pastikan perpindahan antar dompet tidak menyamarkan pengeluaran konsumtif kecil.')
  }

  const compactActions = dedupeLines(actionItems).filter(Boolean).slice(0, 3)

  return [
    buildAdviceSummary({
      focus,
      periodLabel,
      netCashflow,
      totalIncome,
      totalExpense,
      totalSavings,
      topExpense,
      topIncome,
      formatRupiah,
    }),
    '',
    compactActions.length > 0 ? 'Fokus terdekat:' : 'Langkah berikutnya:',
    ...(compactActions.length > 0
      ? compactActions.map((line) => `- ${line}`)
      : ['- Pertahankan pencatatan yang rapi dulu supaya strategi berikutnya bisa lebih presisi.']),
  ].join('\n')
}

function buildAdviceSummary({
  focus,
  periodLabel,
  netCashflow,
  totalIncome,
  totalExpense,
  totalSavings,
  topExpense,
  topIncome,
  formatRupiah,
}) {
  if (focus === 'expense' && topExpense) {
    return `Untuk ${periodLabel}, pengeluaran paling berat masih di ${topExpense.name} sebesar ${formatRupiah(Number(topExpense.amount || 0))}.`
  }

  if (focus === 'income' && topIncome) {
    return `Untuk ${periodLabel}, pemasukan paling besar datang dari ${topIncome.name} sebesar ${formatRupiah(Number(topIncome.amount || 0))}.`
  }

  if (focus === 'savings') {
    return totalSavings > 0
      ? `Untuk ${periodLabel}, tabungan yang sudah dialokasikan baru ${formatRupiah(totalSavings)}.`
      : `Untuk ${periodLabel}, belum ada tabungan yang benar-benar diamankan dari arus kas.`
  }

  if (focus === 'budget' && topExpense) {
    return `Untuk ${periodLabel}, pos yang paling menekan budget masih ${topExpense.name} sebesar ${formatRupiah(Number(topExpense.amount || 0))}.`
  }

  if (netCashflow < 0) {
    return `Untuk ${periodLabel}, arus kas kamu sedang negatif ${formatSignedCurrency(netCashflow, formatRupiah)} karena pengeluaran dan tabungan sudah lebih besar dari pemasukan.`
  }

  if (netCashflow > 0) {
    const anchor = topExpense
      ? ` Pengeluaran paling berat tetap ada di ${topExpense.name}.`
      : totalSavings > 0
        ? ` Sudah ada ${formatRupiah(totalSavings)} yang masuk ke tabungan.`
        : ''
    return `Untuk ${periodLabel}, arus kas kamu masih positif ${formatSignedCurrency(netCashflow, formatRupiah)}.${anchor}`
  }

  if (totalIncome > 0 || totalExpense > 0 || totalSavings > 0) {
    return `Untuk ${periodLabel}, arus kas kamu sedang impas ${formatRupiah(0)}.`
  }

  return `Untuk ${periodLabel}, data keuangannya masih terlalu tipis untuk dibaca lebih dalam.`
}

function buildBudgetAlerts({ budgets = [], topExpenseCategories = [] }) {
  return budgets
    .map((budget) => {
      const category = budget.categories?.name
      const matching = topExpenseCategories.find((item) => item.name === category)
      const spent = Number(matching?.amount || 0)
      const limit = Number(budget.monthly_limit || 0)
      const percent = limit > 0 ? (spent / limit) * 100 : 0
      return { category, spent, limit, percent }
    })
    .filter((item) => item.category && item.percent >= 80)
    .sort((left, right) => right.percent - left.percent)
}

function findNextGoal(goals = []) {
  return goals
    .filter((goal) => goal.status !== 'completed')
    .sort((left, right) => {
      const leftRemaining = Number(left.target_amount || 0) - Number(left.current_amount || 0)
      const rightRemaining = Number(right.target_amount || 0) - Number(right.current_amount || 0)
      return leftRemaining - rightRemaining
    })[0] || null
}

function findRecentExpenseExamples({ transactions = [], categoryName = '' }) {
  const normalizedCategory = String(categoryName || '').toLowerCase()
  const expenseTransactions = transactions.filter((transaction) => transaction.analyticsBucket === 'expense')
  const categoryMatches = normalizedCategory
    ? expenseTransactions.filter(
        (transaction) => String(transaction.category || '').toLowerCase() === normalizedCategory
      )
    : []
  const source = categoryMatches.length > 0 ? categoryMatches : expenseTransactions

  return dedupeLines(
    source
      .slice(0, 3)
      .map((transaction) => transaction.title || transaction.desc || transaction.category)
      .filter(Boolean)
  ).slice(0, 2)
}

function resolveCategoryShare(category, totalAmount) {
  if (Number(category?.percentage || 0) > 0) {
    return Number(category.percentage || 0)
  }

  if (totalAmount <= 0) {
    return 0
  }

  return (Number(category?.amount || 0) / totalAmount) * 100
}

function formatShortList(items = []) {
  if (items.length === 0) {
    return ''
  }

  if (items.length === 1) {
    return items[0]
  }

  return `${items[0]} atau ${items[1]}`
}

function dedupeLines(items = []) {
  return [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))]
}

function buildCategoryRankingReply({ intro, categories, formatRupiah, emptyMessage }) {
  if (!Array.isArray(categories) || categories.length === 0) {
    return emptyMessage
  }

  return [
    intro,
    ...categories.slice(0, 3).map((category, index) => {
      return `${index + 1}. ${category.name} - ${formatRupiah(Number(category.amount || 0))} (${formatPercentage(category.percentage)})`
    }),
  ].join('\n')
}

function formatPrimaryCategory({ label, category, formatRupiah }) {
  if (!category) {
    return ''
  }

  return ` ${label} datang dari ${category.name} sebesar ${formatRupiah(Number(category.amount || 0))} (${formatPercentage(category.percentage)}).`
}

function formatGoalHint(goal, formatRupiah) {
  if (!goal) {
    return ''
  }

  return ` Target aktif terdekat saat ini ${goal.name}, tersisa ${formatRupiah(Math.max(Number(goal.target_amount || 0) - Number(goal.current_amount || 0), 0))}.`
}

function buildCashflowComment(netCashflow, totalIncome, totalExpense, totalSavings) {
  if (netCashflow > 0) {
    return 'Arus kas kamu masih positif, jadi ruang geraknya sehat.'
  }

  if (netCashflow === 0 && totalIncome === 0 && totalExpense === 0 && totalSavings === 0) {
    return 'Belum ada arus kas yang cukup untuk dianalisis.'
  }

  if (netCashflow === 0) {
    return 'Arus kas kamu sedang impas.'
  }

  return 'Arus kas kamu sedang tertekan. Pengeluaran dan tabungan sudah lebih besar dari pemasukan di periode ini.'
}

function formatGoalProgress(goal) {
  const target = Math.max(Number(goal.target_amount || 0), 1)
  const current = Number(goal.current_amount || 0)
  return `${Math.round((current / target) * 100)}%`
}

function formatSignedCurrency(amount, formatRupiah) {
  if (amount === 0) {
    return formatRupiah(0)
  }

  return amount > 0 ? `+${formatRupiah(amount)}` : `-${formatRupiah(Math.abs(amount))}`
}

function formatPercentage(value) {
  return `${Number(value || 0).toFixed(1)}%`
}
