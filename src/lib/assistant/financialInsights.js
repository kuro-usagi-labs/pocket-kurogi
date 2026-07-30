import { formatDateTime, formatPercentage, formatRupiah } from './formatters'
import { reasonAboutFinancialHealth } from './financeReasoningEngine'

const DAY_MS = 24 * 60 * 60 * 1000

export function buildFinancialInsightSnapshot({
  transactions = [],
  budgets = [],
  goals = [],
  now = new Date(),
} = {}) {
  const normalized = transactions
    .map(normalizeTransaction)
    .filter((transaction) => transaction.amount > 0 && transaction.occurredAt)
  const current = new Date(now)
  const todayStart = startOfDay(current)
  const monthStart = new Date(current.getFullYear(), current.getMonth(), 1)
  const previousMonthStart = new Date(current.getFullYear(), current.getMonth() - 1, 1)
  const previousMonthEnd = new Date(monthStart.getTime() - 1)
  const weekStart = startOfWeek(current)
  const previousWeekStart = new Date(weekStart.getTime() - 7 * DAY_MS)
  const previousWeekEnd = new Date(weekStart.getTime() - 1)
  const currentMonth = within(normalized, monthStart, current)
  const previousMonth = within(normalized, previousMonthStart, previousMonthEnd)
  const currentWeek = within(normalized, weekStart, current)
  const previousWeek = within(normalized, previousWeekStart, previousWeekEnd)
  const today = within(normalized, todayStart, current)
  const expenseCurrentMonth = currentMonth.filter(isExpense)
  const incomeCurrentMonth = currentMonth.filter(isIncome)
  const expensePreviousMonth = previousMonth.filter(isExpense)
  const elapsedDays = Math.max(Math.floor((current - monthStart) / DAY_MS) + 1, 1)
  const categoryTotals = groupAmounts(expenseCurrentMonth, (item) => item.category || 'Lainnya')
  const merchantTotals = groupAmounts(expenseCurrentMonth, (item) => item.merchant || item.description || 'Tanpa merchant')
  const totalExpense = sumAmounts(expenseCurrentMonth)
  const previousExpense = sumAmounts(expensePreviousMonth)
  const totalIncome = sumAmounts(incomeCurrentMonth)
  const dailyAverage = totalExpense / elapsedDays

  return {
    sourceTransactionCount: normalized.length,
    generatedAt: current.toISOString(),
    today: {
      expense: sumAmounts(today.filter(isExpense)),
      income: sumAmounts(today.filter(isIncome)),
      transactionCount: today.length,
    },
    currentMonth: {
      expense: totalExpense,
      income: totalIncome,
      netCashflow: totalIncome - totalExpense,
      dailyAverage,
      projectedExpense: dailyAverage * daysInMonth(current),
      transactionCount: currentMonth.length,
    },
    previousMonth: {
      expense: previousExpense,
      income: sumAmounts(previousMonth.filter(isIncome)),
      transactionCount: previousMonth.length,
    },
    currentWeek: summarizePeriod(currentWeek),
    previousWeek: summarizePeriod(previousWeek),
    comparison: {
      expenseChangeAmount: totalExpense - previousExpense,
      expenseChangePercent: previousExpense > 0
        ? ((totalExpense - previousExpense) / previousExpense) * 100
        : null,
      weeklyExpenseChangeAmount:
        sumAmounts(currentWeek.filter(isExpense)) -
        sumAmounts(previousWeek.filter(isExpense)),
      weeklyExpenseChangePercent: sumAmounts(previousWeek.filter(isExpense)) > 0
        ? (
            (
              sumAmounts(currentWeek.filter(isExpense)) -
              sumAmounts(previousWeek.filter(isExpense))
            ) /
            sumAmounts(previousWeek.filter(isExpense))
          ) * 100
        : null,
    },
    topCategories: categoryTotals.slice(0, 5),
    topMerchants: merchantTotals.slice(0, 5),
    unusualExpenses: detectUnusualExpenses(expenseCurrentMonth),
    recurringTransactions: detectRecurringTransactions(normalized),
    budgetUsage: buildBudgetUsage(budgets, categoryTotals),
    goalProgress: buildGoalProgress(goals),
  }
}

export function composeFinancialInsight(snapshot, {
  focus = 'overview',
} = {}) {
  if (!snapshot || snapshot.sourceTransactionCount === 0) {
    return {
      available: false,
      text: 'Data transaksi belum cukup untuk membuat insight yang dapat dipercaya.',
      details: [],
    }
  }

  if (focus === 'today') {
    return {
      available: true,
      text: `Hari ini pengeluaranmu ${formatRupiah(snapshot.today.expense)} dari ${snapshot.today.transactionCount} transaksi.`,
      details: buildTopCategoryDetail(snapshot),
    }
  }

  if (focus === 'week') {
    const weeklyChange = snapshot.comparison.weeklyExpenseChangePercent
    const comparison = weeklyChange === null
      ? 'Belum ada data minggu lalu yang cukup untuk pembanding.'
      : `Nilainya ${Math.abs(weeklyChange).toFixed(1)}% ${weeklyChange >= 0 ? 'lebih tinggi' : 'lebih rendah'} dibanding minggu lalu.`
    return {
      available: true,
      text: `Pengeluaran minggu ini ${formatRupiah(snapshot.currentWeek.expense)} dari ${snapshot.currentWeek.transactionCount} transaksi. ${comparison}`,
      details: buildTopCategoryDetail({
        topCategories: snapshot.currentWeek.topCategories,
      }),
    }
  }

  const change = snapshot.comparison.expenseChangePercent
  const comparison = change === null
    ? 'Belum ada data bulan sebelumnya yang cukup untuk pembanding.'
    : `Dibanding bulan sebelumnya, pengeluaran ${change >= 0 ? 'naik' : 'turun'} ${formatPercentage(Math.abs(change))}.`

  return {
    available: true,
    text: `Bulan ini pemasukan ${formatRupiah(snapshot.currentMonth.income)} dan pengeluaran ${formatRupiah(snapshot.currentMonth.expense)}. ${comparison}`,
    details: [
      ...buildTopCategoryDetail(snapshot),
      `Rata-rata pengeluaran harian ${formatRupiah(snapshot.currentMonth.dailyAverage)}.`,
    ],
  }
}

export function composeFinancialQueryResult({
  intent,
  slots = {},
  snapshot,
  transactions = [],
  wallets = [],
  memory = [],
  now = new Date(),
} = {}) {
  if (intent === 'query_balance') {
    const activeWallets = wallets.filter((wallet) => !wallet.is_archived)
    const selected = slots.wallet?.id
      ? activeWallets.find((wallet) => wallet.id === slots.wallet.id)
      : null
    if (selected) {
      return createQueryInsight(
        `Saldo ${selected.name} saat ini ${formatRupiah(selected.current_balance)}.`,
        [`Sumber: saldo dompet yang tersimpan di database.`]
      )
    }
    if (activeWallets.length === 0) {
      return unavailableInsight('Belum ada dompet aktif yang dapat dihitung.')
    }
    const total = activeWallets.reduce(
      (sum, wallet) => sum + Number(wallet.current_balance || 0),
      0
    )
    return createQueryInsight(
      `Total saldo ${activeWallets.length} dompet aktif adalah ${formatRupiah(total)}.`,
      activeWallets.map((wallet) =>
        `${wallet.name}: ${formatRupiah(wallet.current_balance)}`
      )
    )
  }

  if (intent === 'query_transactions') {
    const filtered = filterTransactions(transactions, slots)
    if (filtered.length === 0) {
      return unavailableInsight('Tidak ada transaksi yang cocok dengan permintaan itu.')
    }
    return createQueryInsight(
      `Aku menemukan ${filtered.length} transaksi yang cocok. Lima transaksi terbaru ditampilkan di bawah.`,
      filtered.slice(0, 5).map((transaction) => {
        const type = normalizeTransaction(transaction).type === 'income'
          ? 'Pemasukan'
          : 'Pengeluaran'
        const normalized = normalizeTransaction(transaction)
        return `${type} ${formatRupiah(normalized.amount)}${normalized.merchant ? ` - ${normalized.merchant}` : ''} (${formatDateTime(normalized.occurredAt)})`
      })
    )
  }

  if (intent === 'query_income') {
    return snapshot?.sourceTransactionCount
      ? createQueryInsight(
          `Pemasukan bulan ini ${formatRupiah(snapshot.currentMonth.income)}.`,
          [`Arus kas bersih bulan ini ${formatRupiah(snapshot.currentMonth.netCashflow)}.`]
        )
      : unavailableInsight('Data transaksi belum cukup untuk menghitung pemasukan.')
  }

  if (intent === 'query_expenses') {
    return snapshot?.sourceTransactionCount
      ? createQueryInsight(
          `Pengeluaran bulan ini ${formatRupiah(snapshot.currentMonth.expense)}.`,
          [
            `Rata-rata harian ${formatRupiah(snapshot.currentMonth.dailyAverage)}.`,
            ...buildTopCategoryDetail(snapshot),
          ]
        )
      : unavailableInsight('Data transaksi belum cukup untuk menghitung pengeluaran.')
  }

  if (intent === 'query_wallet') {
    const wallet = wallets.find((entry) => entry.id === slots.wallet?.id)
    if (!wallet) return unavailableInsight('Dompet yang dimaksud tidak ditemukan.')
    const walletTransactions = filterTransactions(transactions, {
      wallet: { id: wallet.id },
    })
    return createQueryInsight(
      `Saldo ${wallet.name} ${formatRupiah(wallet.current_balance)} dengan ${walletTransactions.length} transaksi pada data yang tersedia.`,
      walletTransactions.slice(0, 3).map((transaction) => {
        const normalized = normalizeTransaction(transaction)
        return `${normalized.type === 'income' ? 'Masuk' : 'Keluar'} ${formatRupiah(normalized.amount)} - ${normalized.merchant || normalized.description || 'Transaksi'}`
      })
    )
  }

  if (intent === 'query_budget') {
    const usage = (snapshot?.budgetUsage || []).filter((entry) =>
      !slots.category?.name ||
      entry.category.toLowerCase() === slots.category.name.toLowerCase()
    )
    if (usage.length === 0) return unavailableInsight('Belum ada budget yang cocok.')
    return createQueryInsight(
      usage.length === 1
        ? `Budget ${usage[0].category} terpakai ${formatRupiah(usage[0].spent)} dari ${formatRupiah(usage[0].limit)}.`
        : `Ada ${usage.length} budget aktif. Pemakaian bulan berjalan dihitung dari transaksi database.`,
      usage.map((entry) =>
        `${entry.category}: ${formatPercentage(entry.percentage)} terpakai, sisa ${formatRupiah(entry.remaining)}`
      )
    )
  }

  if (intent === 'query_saving_goal') {
    const progress = (snapshot?.goalProgress || []).filter((entry) =>
      !slots.goal?.id || entry.id === slots.goal.id
    )
    if (progress.length === 0) return unavailableInsight('Belum ada target tabungan yang cocok.')
    return createQueryInsight(
      progress.length === 1
        ? `Target ${progress[0].name} sudah mencapai ${formatPercentage(progress[0].percentage)}.`
        : `Ada ${progress.length} target tabungan pada akunmu.`,
      progress.map((entry) =>
        `${entry.name}: ${formatRupiah(entry.current)} dari ${formatRupiah(entry.target)}, kurang ${formatRupiah(entry.remaining)}`
      )
    )
  }

  if (intent === 'query_category_summary') {
    const categoryName = slots.category?.name
    const entries = categoryName
      ? (snapshot?.topCategories || []).filter((entry) =>
          entry.name.toLowerCase() === categoryName.toLowerCase()
        )
      : snapshot?.topCategories || []
    if (entries.length === 0) return unavailableInsight('Belum ada pengeluaran kategori yang cocok bulan ini.')
    return createQueryInsight(
      categoryName
        ? `Pengeluaran ${entries[0].name} bulan ini ${formatRupiah(entries[0].amount)}.`
        : `Kategori pengeluaran terbesar bulan ini adalah ${entries[0].name} sebesar ${formatRupiah(entries[0].amount)}.`,
      entries.slice(0, 5).map((entry) =>
        `${entry.name}: ${formatRupiah(entry.amount)} (${formatPercentage(entry.percentage)})`
      )
    )
  }

  if (intent === 'financial_advice') {
    const reasoning = reasonAboutFinancialHealth({
      snapshot,
      wallets,
    })
    const {
      activeBalance,
      topCategory,
      exceededBudgets,
      netCashflow,
    } = reasoning.evidence
    if (reasoning.code === 'INSUFFICIENT_DATA') {
      return unavailableInsight(
        'Saya belum punya saldo atau transaksi yang cukup untuk memberi saran yang bertanggung jawab.'
      )
    }

    const details = [`Saldo aktif saat ini ${formatRupiah(activeBalance)}.`]
    if (reasoning.evidence.transactionCount > 0) {
      details.push(
        `Arus kas bersih bulan ini ${formatRupiah(netCashflow)}.`
      )
      if (topCategory) {
        details.push(
          `Pengeluaran terbesar: ${topCategory.name} ${formatRupiah(topCategory.amount)}.`
        )
      }
      if (exceededBudgets.length > 0) {
        details.push(
          `Budget terlewati: ${exceededBudgets
            .slice(0, 3)
            .map((entry) => `${entry.category} ${formatPercentage(entry.percentage)}`)
            .join(', ')}.`
        )
      }
    }

    return {
      ...createQueryInsight(composeReasoningAdvice(reasoning), details),
      reasoning,
    }
  }

  if (intent === 'emotional_support') {
    const base = composeFinancialInsight(snapshot, { focus: 'week' })
    const salaryDate = memory.find((entry) =>
      entry.key === 'salary_date' && Number(entry.confidence || 0) >= 0.75
    )
    const activeBalance = wallets
      .filter((wallet) => !wallet.is_archived)
      .reduce((sum, wallet) => sum + Number(wallet.current_balance || 0), 0)
    if (!salaryDate) {
      return {
        ...base,
        details: [
          ...(base.details || []),
          `Saldo aktif di database ${formatRupiah(activeBalance)}.`,
          'Sebutkan tanggal gajian dan tagihan wajib yang belum dibayar agar batas harian dapat dihitung aman.',
        ],
      }
    }
    const daysUntilIncome = daysUntilSalaryDate(now, Number(salaryDate.value))
    const runway = buildRunwayInsight({
      balance: activeBalance,
      requiredExpenses: 0,
      daysUntilIncome,
    })
    return {
      ...base,
      details: [
        ...(base.details || []),
        runway.text,
        'Batas ini belum mengurangi tagihan wajib yang belum tercatat.',
      ],
    }
  }

  return composeFinancialInsight(snapshot, {
    focus: intent === 'emotional_support' ? 'week' : 'overview',
  })
}

function composeReasoningAdvice(reasoning) {
  if (reasoning.code === 'BUDGET_EXCEEDED') {
    return `Prioritas pertama: hentikan sementara pengeluaran tambahan pada ${reasoning.focusCategory} sampai budget kembali terkendali.`
  }
  if (reasoning.code === 'DISCRETIONARY_DEFICIT') {
    return `Prioritas pertama: kurangi ${reasoning.focusCategory} dan lindungi uang untuk makan dasar, transport kerja, kesehatan, serta tagihan wajib.`
  }
  if (reasoning.code === 'NEGATIVE_CASHFLOW') {
    return 'Pengeluaran bulan ini lebih besar daripada pemasukan. Tahan belanja fleksibel dan amankan kebutuhan wajib terlebih dahulu.'
  }
  if (reasoning.code === 'NO_ACTIVE_BALANCE') {
    return 'Saldo aktif belum tersedia. Mulai dari mencatat pemasukan atau mengisi saldo dompet sebelum menetapkan pengeluaran baru.'
  }
  return 'Keuanganmu belum menunjukkan alarm utama. Pertahankan pencatatan, jaga budget kategori, dan sisihkan dana untuk kebutuhan wajib serta target.'
}

function daysUntilSalaryDate(now, salaryDay) {
  const current = new Date(now)
  const safeDay = Math.min(Math.max(Math.trunc(salaryDay || 1), 1), 31)
  const candidate = new Date(
    current.getFullYear(),
    current.getMonth(),
    Math.min(safeDay, daysInMonth(current)),
    12
  )
  if (candidate <= current) {
    const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1)
    const nextDay = Math.min(safeDay, daysInMonth(nextMonth))
    candidate.setTime(new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth(),
      nextDay,
      12
    ).getTime())
  }
  return Math.max(Math.ceil((candidate - current) / DAY_MS), 1)
}

export function buildRunwayInsight({
  balance,
  requiredExpenses = 0,
  daysUntilIncome,
} = {}) {
  const normalizedBalance = Number(balance || 0)
  const normalizedRequired = Math.max(Number(requiredExpenses || 0), 0)
  const days = Math.max(Number(daysUntilIncome || 0), 1)
  const disposable = Math.max(normalizedBalance - normalizedRequired, 0)
  const dailyLimit = disposable / days

  return {
    balance: normalizedBalance,
    requiredExpenses: normalizedRequired,
    daysUntilIncome: days,
    disposable,
    dailyLimit,
    tight: dailyLimit < 50_000,
    text: `Setelah menyisihkan kebutuhan wajib ${formatRupiah(normalizedRequired)}, batas kasarnya sekitar ${formatRupiah(dailyLimit)} per hari selama ${days} hari.`,
  }
}

function normalizeTransaction(transaction) {
  const type = transaction.type || transaction.transaction_type
  const occurredAt = transaction.occurredAt || transaction.occurred_at
  return {
    id: transaction.id,
    type,
    amount: Number(transaction.amount || 0),
    category: transaction.category || transaction.categories?.name || null,
    merchant: transaction.merchant || null,
    description: transaction.desc || transaction.title || transaction.notes || null,
    occurredAt: occurredAt ? new Date(occurredAt) : null,
  }
}

function filterTransactions(transactions, slots) {
  return transactions
    .map((transaction) => ({
      raw: transaction,
      normalized: normalizeTransaction(transaction),
    }))
    .filter(({ raw, normalized }) => {
      if (slots.wallet?.id && String(raw.wallet_id || raw.walletId) !== slots.wallet.id) {
        return false
      }
      if (
        slots.category?.name &&
        String(normalized.category || '').toLowerCase() !== slots.category.name.toLowerCase()
      ) {
        return false
      }
      if (
        slots.transactionType &&
        normalized.type !== slots.transactionType
      ) {
        return false
      }
      return true
    })
    .sort((left, right) => right.normalized.occurredAt - left.normalized.occurredAt)
    .map(({ raw }) => raw)
}

function createQueryInsight(text, details = []) {
  return {
    available: true,
    text,
    details,
  }
}

function unavailableInsight(text) {
  return {
    available: false,
    text,
    details: [],
  }
}

function within(transactions, start, end) {
  return transactions.filter((transaction) =>
    transaction.occurredAt >= start && transaction.occurredAt <= end
  )
}

function isExpense(transaction) {
  return transaction.type === 'expense'
}

function isIncome(transaction) {
  return transaction.type === 'income'
}

function sumAmounts(transactions) {
  return transactions.reduce((sum, transaction) => sum + transaction.amount, 0)
}

function groupAmounts(transactions, getKey) {
  const groups = new Map()
  for (const transaction of transactions) {
    const key = getKey(transaction)
    const current = groups.get(key) || { name: key, amount: 0, count: 0 }
    current.amount += transaction.amount
    current.count += 1
    groups.set(key, current)
  }
  const total = sumAmounts(transactions)
  return Array.from(groups.values())
    .map((entry) => ({
      ...entry,
      percentage: total > 0 ? (entry.amount / total) * 100 : 0,
    }))
    .sort((left, right) => right.amount - left.amount)
}

function detectUnusualExpenses(expenses) {
  if (expenses.length < 5) return []
  const average = sumAmounts(expenses) / expenses.length
  const variance = expenses.reduce((sum, item) => sum + ((item.amount - average) ** 2), 0) / expenses.length
  const deviation = Math.sqrt(variance)
  const threshold = average + deviation * 1.5
  return expenses
    .filter((item) => item.amount > threshold)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5)
}

function detectRecurringTransactions(transactions) {
  const groups = new Map()
  for (const transaction of transactions) {
    const key = [
      transaction.type,
      String(transaction.merchant || transaction.description || '').toLowerCase(),
      Math.round(transaction.amount / 1_000),
    ].join('|')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(transaction)
  }

  return Array.from(groups.values())
    .filter((items) => items.length >= 2)
    .map((items) => ({
      description: items[0].merchant || items[0].description,
      amount: items.reduce((sum, item) => sum + item.amount, 0) / items.length,
      occurrences: items.length,
      lastOccurredAt: items
        .map((item) => item.occurredAt)
        .sort((left, right) => right - left)[0]
        .toISOString(),
    }))
    .sort((left, right) => right.occurrences - left.occurrences)
}

function buildBudgetUsage(budgets, categoryTotals) {
  return budgets.map((budget) => {
    const category = budget.categories?.name || budget.category || budget.categoryName
    const spent = categoryTotals.find((item) => item.name === category)?.amount || 0
    const limit = Number(budget.monthly_limit || budget.limit || 0)
    return {
      id: budget.id,
      category,
      spent,
      limit,
      remaining: Math.max(limit - spent, 0),
      percentage: limit > 0 ? (spent / limit) * 100 : 0,
    }
  })
}

function buildGoalProgress(goals) {
  return goals.map((goal) => {
    const target = Number(goal.target_amount || goal.targetAmount || 0)
    const current = Number(goal.current_amount || goal.currentAmount || 0)
    return {
      id: goal.id,
      name: goal.name,
      current,
      target,
      remaining: Math.max(target - current, 0),
      percentage: target > 0 ? (current / target) * 100 : 0,
    }
  })
}

function buildTopCategoryDetail(snapshot) {
  const top = snapshot.topCategories?.[0]
  if (!top) return []
  return [`Kategori terbesar adalah ${top.name} sebesar ${formatRupiah(top.amount)} (${formatPercentage(top.percentage)}).`]
}

function startOfDay(value) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function startOfWeek(value) {
  const date = startOfDay(value)
  const day = date.getDay()
  const distanceToMonday = day === 0 ? 6 : day - 1
  date.setDate(date.getDate() - distanceToMonday)
  return date
}

function summarizePeriod(transactions) {
  const expenses = transactions.filter(isExpense)
  const income = transactions.filter(isIncome)
  return {
    expense: sumAmounts(expenses),
    income: sumAmounts(income),
    netCashflow: sumAmounts(income) - sumAmounts(expenses),
    transactionCount: transactions.length,
    topCategories: groupAmounts(expenses, (item) => item.category || 'Lainnya').slice(0, 5),
  }
}

function daysInMonth(value) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate()
}
