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
    return `Belum ada data ledger untuk ${periodLabel}. Coba catat transaksi dulu, lalu tanya lagi supaya saya bisa membacakan polanya.`
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
  formatRupiah,
}) {
  const {
    totalIncome = 0,
    totalExpense = 0,
    totalSavings = 0,
    netCashflow = 0,
    topExpenseCategories = [],
    topIncomeCategories = [],
  } = snapshot || {}

  const periodLabel = query?.periodLabel || PERIOD_LABELS[query?.period] || PERIOD_LABELS.all_time
  const trackedTotal = totalIncome + totalExpense + Math.abs(totalSavings)

  if (trackedTotal <= 0) {
    return `Saya belum punya cukup data untuk memberi strategi ${periodLabel}. Coba catat beberapa pemasukan atau pengeluaran dulu, lalu tanya lagi.`
  }

  const topExpense = topExpenseCategories[0] || null
  const topIncome = topIncomeCategories[0] || null
  const budgetAlerts = budgets
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

  const nextGoal = goals
    .filter((goal) => goal.status !== 'completed')
    .sort((left, right) => {
      const leftRemaining = Number(left.target_amount || 0) - Number(left.current_amount || 0)
      const rightRemaining = Number(right.target_amount || 0) - Number(right.current_amount || 0)
      return leftRemaining - rightRemaining
    })[0]

  const lines = [`Strategi ${periodLabel}:`]

  if (query?.focus === 'expense' || query?.focus === 'overall' || query?.focus === 'budget') {
    if (topExpense) {
      lines.push(`1. Tahan ${topExpense.name} dulu, karena ini pengeluaran terbesar di ${periodLabel}: ${formatRupiah(topExpense.amount)}.`)
    }

    if (budgetAlerts[0]) {
      lines.push(`2. Budget ${budgetAlerts[0].category} sudah ${budgetAlerts[0].percent.toFixed(0)}% terpakai. Batasi transaksi kecil di kategori ini.`)
    }
  }

  if ((query?.focus === 'savings' || query?.focus === 'overall') && totalIncome > 0) {
    const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0
    if (savingsRate < 10) {
      lines.push(`3. Naikkan alokasi tabungan minimal ke 10% dari pemasukan. Sekarang baru sekitar ${savingsRate.toFixed(1)}%.`)
    } else if (nextGoal) {
      const remaining = Math.max(Number(nextGoal.target_amount || 0) - Number(nextGoal.current_amount || 0), 0)
      lines.push(`3. Fokus selesaikan target ${nextGoal.name}. Sisa yang perlu dikejar ${formatRupiah(remaining)}.`)
    }
  }

  if ((query?.focus === 'income' || query?.focus === 'overall') && topIncome) {
    lines.push(`4. Jaga sumber pemasukan utama di ${topIncome.name} karena kontribusinya paling besar: ${formatRupiah(topIncome.amount)}.`)
  }

  if (netCashflow < 0) {
    lines.push('5. Arus kas sedang negatif. Prioritaskan menahan pengeluaran variabel sebelum menambah target baru.')
  } else if (netCashflow > 0) {
    lines.push('5. Arus kas masih positif. Kelebihan bulan ini paling aman diarahkan ke tabungan atau target prioritas.')
  }

  return lines.slice(0, 4).join('\n')
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
