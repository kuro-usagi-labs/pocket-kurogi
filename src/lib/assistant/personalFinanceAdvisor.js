import { formatPercentage, formatRupiah } from './formatters'
import {
  buildPlanningCalendar,
  formatPlanningDate,
  simulateSavingsPlan,
} from '../financialPlanning'

const DAY_MS = 24 * 60 * 60 * 1000

export const DEFAULT_ADVICE_PREFERENCES = Object.freeze({
  tone: 'gentle',
  weeklySummary: true,
  unusualSpending: true,
  goalForecast: true,
  affordability: true,
  savingTips: true,
  recurringPayments: true,
})

export function resolveAdvicePreferences(memory = []) {
  const stored = memory.find((entry) =>
    entry.key === 'advice_preferences' && Number(entry.confidence || 0) >= 0.75
  )?.value
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    return { ...DEFAULT_ADVICE_PREFERENCES }
  }
  return {
    ...DEFAULT_ADVICE_PREFERENCES,
    ...Object.fromEntries(
      Object.entries(stored).filter(([key, value]) =>
        key === 'tone'
          ? ['gentle', 'direct', 'brief'].includes(value)
          : key in DEFAULT_ADVICE_PREFERENCES && typeof value === 'boolean'
      )
    ),
  }
}

export function composePersonalFinancialAdvice({
  text = '',
  slots = {},
  snapshot,
  transactions = [],
  wallets = [],
  budgets = [],
  goals = [],
  memory = [],
  schedules = [],
  reminderPreferences = {},
  now = new Date(),
  forceFocus = null,
} = {}) {
  const preferences = resolveAdvicePreferences(memory)
  const focus = forceFocus || detectAdviceFocus(text)
  const preferenceKey = {
    week: 'weeklySummary',
    unusual: 'unusualSpending',
    goal: 'goalForecast',
    affordability: 'affordability',
    saving: 'savingTips',
    recurring: 'recurringPayments',
  }[focus]

  if (preferenceKey && preferences[preferenceKey] === false) {
    return disabledAdvice(focus)
  }

  const result = {
    week: () => composeWeeklySummary(snapshot, now),
    unusual: () => composeUnusualSpending({ transactions, now }),
    goal: () => composeGoalForecast({ goals, transactions, now }),
    affordability: () => composeAffordability({
      slots,
      snapshot,
      transactions,
      wallets,
      budgets,
      goals,
      now,
    }),
    recurring: () => composeRecurringPayments({ transactions, now }),
    simulation: () => composeSavingsSimulation({ slots, goals, now }),
    calendar: () => composePlanningCalendar({ schedules, reminderPreferences, now }),
    saving: () => composeSavingRecommendation({ snapshot, budgets }),
  }[focus]?.() || composeSavingRecommendation({ snapshot, budgets })

  return applyAdviceTone(result, preferences.tone)
}

export function detectRecurringPayments(transactions = [], now = new Date()) {
  const groups = new Map()
  for (const transaction of transactions.map(normalizeTransaction)) {
    if (transaction.type !== 'expense' || !transaction.occurredAt) continue
    const label = transaction.merchant || transaction.description
    if (!label || transaction.amount <= 0) continue
    const key = `${normalizeLabel(label)}|${Math.round(transaction.amount / 5_000)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(transaction)
  }

  return Array.from(groups.values()).flatMap((items) => {
    const sorted = [...items].sort((left, right) => left.occurredAt - right.occurredAt)
    if (sorted.length < 2) return []
    const intervals = sorted.slice(1).map((item, index) =>
      Math.round((item.occurredAt - sorted[index].occurredAt) / DAY_MS)
    ).filter((days) => days >= 5 && days <= 45)
    if (intervals.length === 0) return []
    const cadenceDays = median(intervals)
    const isPlausibleCadence = (cadenceDays >= 6 && cadenceDays <= 8) ||
      (cadenceDays >= 25 && cadenceDays <= 35)
    if (!isPlausibleCadence) return []
    const last = sorted.at(-1)
    const nextExpectedAt = new Date(last.occurredAt.getTime() + cadenceDays * DAY_MS)
    return [{
      description: last.merchant || last.description,
      averageAmount: sorted.reduce((sum, item) => sum + item.amount, 0) / sorted.length,
      occurrences: sorted.length,
      cadenceDays,
      lastOccurredAt: last.occurredAt.toISOString(),
      nextExpectedAt: nextExpectedAt.toISOString(),
      daysUntilExpected: Math.ceil((nextExpectedAt - new Date(now)) / DAY_MS),
    }]
  }).sort((left, right) => left.daysUntilExpected - right.daysUntilExpected)
}

export function buildGoalForecasts(goals = [], transactions = [], now = new Date()) {
  const normalized = transactions.map(normalizeTransaction)
  return goals.filter((goal) => goal.status !== 'completed').map((goal) => {
    const current = Number(goal.current_amount || goal.currentAmount || 0)
    const target = Number(goal.target_amount || goal.targetAmount || 0)
    const remaining = Math.max(target - current, 0)
    const goalName = String(goal.name || '')
    const contributions = normalized.filter((transaction) =>
      transaction.source === 'goal_contribution' &&
      normalizeLabel(transaction.merchant).includes(normalizeLabel(goalName)) &&
      transaction.occurredAt >= new Date(new Date(now).getTime() - 90 * DAY_MS)
    )
    const contributionTotal = contributions.reduce((sum, item) => sum + item.amount, 0)
    const earliestContributionAt = contributions.length > 0
      ? Math.min(...contributions.map((item) => item.occurredAt.getTime()))
      : null
    const observedDays = contributions.length >= 2
      ? Math.max((new Date(now).getTime() - earliestContributionAt) / DAY_MS, 30)
      : 90
    const monthlyRate = contributions.length > 0
      ? contributionTotal / observedDays * 30
      : 0
    const monthsRemaining = monthlyRate > 0 ? remaining / monthlyRate : null
    const estimatedCompletionAt = monthsRemaining !== null
      ? new Date(new Date(now).getTime() + monthsRemaining * 30 * DAY_MS)
      : null
    const deadline = goal.deadline ? new Date(goal.deadline) : null
    return {
      id: goal.id,
      name: goalName,
      current,
      target,
      remaining,
      contributionCount: contributions.length,
      monthlyRate,
      estimatedCompletionAt: estimatedCompletionAt?.toISOString() || null,
      deadline: deadline?.toISOString() || null,
      onTrack: deadline && estimatedCompletionAt
        ? estimatedCompletionAt <= deadline
        : null,
    }
  })
}

function composeWeeklySummary(snapshot, now) {
  if (!snapshot?.sourceTransactionCount) {
    return unavailable('Ringkasan mingguan belum tersedia karena belum ada transaksi yang cukup.')
  }
  const top = snapshot.currentWeek.topCategories?.[0]
  const change = snapshot.comparison.weeklyExpenseChangePercent
  return insight({
    text: `Ringkasan minggu ini: pemasukan ${formatRupiah(snapshot.currentWeek.income)}, pengeluaran ${formatRupiah(snapshot.currentWeek.expense)}, dan perubahan saldo ${formatRupiah(snapshot.currentWeek.netCashflow)}.`,
    facts: [
      `Periode: ${formatPeriod(startOfWeek(now), now)}; ${snapshot.currentWeek.transactionCount} transaksi.`,
      top ? `Kategori terbesar: ${top.name} ${formatRupiah(top.amount)} (${formatPercentage(top.percentage)}).` : 'Belum ada kategori pengeluaran minggu ini.',
    ],
    estimates: [change === null
      ? 'Data minggu sebelumnya belum cukup untuk perbandingan.'
      : `Pengeluaran ${change >= 0 ? 'naik' : 'turun'} ${formatPercentage(Math.abs(change))} dibanding minggu sebelumnya.`],
    opinions: [snapshot.currentWeek.netCashflow < 0
      ? 'Jaga belanja fleksibel sampai arus kas mingguan kembali positif.'
      : 'Arus kas mingguan positif; pertimbangkan mengarahkan sebagian surplus ke target aktif.'],
    kind: 'weekly_summary',
  })
}

function composeUnusualSpending({ transactions, now }) {
  const anomaly = findCategoryAnomalies(transactions, now)[0]
  if (!anomaly) {
    return insight({
      text: 'Belum terlihat lonjakan pengeluaran yang cukup kuat untuk disebut tidak biasa.',
      facts: [`Periode diperiksa: minggu berjalan dibanding rata-rata empat minggu sebelumnya.`],
      estimates: ['Kategori dengan riwayat terlalu sedikit tidak dinilai agar tidak menghasilkan alarm palsu.'],
      opinions: ['Lanjutkan pencatatan agar pembanding kebiasaan makin akurat.'],
      kind: 'unusual_spending',
    })
  }
  return insight({
    text: `Pengeluaran ${anomaly.category} minggu ini naik tidak biasa menjadi ${formatRupiah(anomaly.current)}.`,
    facts: [`Periode: minggu berjalan; rata-rata empat minggu sebelumnya ${formatRupiah(anomaly.baseline)} per minggu.`],
    estimates: [`Kenaikan sekitar ${formatPercentage(anomaly.changePercent)} dari kebiasaan empat minggu sebelumnya.`],
    opinions: [`Periksa transaksi ${anomaly.category} terbesar dan tunda pembelian serupa bila bukan kebutuhan wajib.`],
    kind: 'unusual_spending',
  })
}

function composeGoalForecast({ goals, transactions, now }) {
  const forecast = buildGoalForecasts(goals, transactions, now)
    .sort((left, right) => right.current / Math.max(right.target, 1) - left.current / Math.max(left.target, 1))[0]
  if (!forecast) return unavailable('Belum ada target aktif yang dapat diprediksi.')
  if (forecast.monthlyRate <= 0) {
    return insight({
      text: `Target ${forecast.name} masih membutuhkan ${formatRupiah(forecast.remaining)}.`,
      facts: [`Terkumpul ${formatRupiah(forecast.current)} dari ${formatRupiah(forecast.target)}.`],
      estimates: ['Belum ada setoran 90 hari terakhir yang cukup untuk memperkirakan tanggal tercapai.'],
      opinions: ['Tetapkan setoran rutin agar waktu pencapaian dapat dihitung.'],
      kind: 'goal_forecast',
    })
  }
  return insight({
    text: `Dengan pola setoran saat ini, target ${forecast.name} diperkirakan tercapai sekitar ${formatMonth(forecast.estimatedCompletionAt)}.`,
    facts: [`Terkumpul ${formatRupiah(forecast.current)} dari ${formatRupiah(forecast.target)}; ${forecast.contributionCount} setoran dalam data 90 hari terakhir.`],
    estimates: [`Laju setoran sekitar ${formatRupiah(forecast.monthlyRate)} per bulan.${forecast.deadline ? ` Status terhadap tenggat: ${forecast.onTrack ? 'sesuai jalur' : 'berisiko terlambat'}.` : ''}`],
    opinions: [forecast.onTrack === false
      ? 'Naikkan setoran bulanan atau sesuaikan tenggat target.'
      : 'Pertahankan pola setoran dan evaluasi lagi saat pemasukan berubah.'],
    kind: 'goal_forecast',
  })
}

function composeAffordability({ slots, snapshot, transactions, wallets, budgets, goals, now }) {
  const amount = Number(slots.purchaseAmount || slots.amount || 0)
  if (!Number.isFinite(amount) || amount <= 0) {
    return unavailable('Sebutkan harga barang agar aku bisa menghitung apakah pembelian itu aman.')
  }
  const balance = wallets.filter((wallet) => !wallet.is_archived)
    .reduce((sum, wallet) => sum + Number(wallet.current_balance || 0), 0)
  const recurring = detectRecurringPayments(transactions, now)
    .filter((entry) => entry.daysUntilExpected >= 0 && entry.daysUntilExpected <= 14)
  const nearBills = recurring.reduce((sum, entry) => sum + entry.averageAmount, 0)
  const forecasts = buildGoalForecasts(goals, transactions, now)
  const monthlyGoalNeed = forecasts.reduce((sum, goal) => sum + Math.max(goal.monthlyRate, 0), 0)
  const relevantBudget = slots.category?.name
    ? budgets.find((budget) => normalizeLabel(budget.category || budget.categories?.name) === normalizeLabel(slots.category.name))
    : null
  const spent = relevantBudget
    ? snapshot?.budgetUsage?.find((entry) => entry.id === relevantBudget.id)?.spent || 0
    : 0
  const budgetRemaining = relevantBudget
    ? Math.max(Number(relevantBudget.monthly_limit || relevantBudget.limit || 0) - spent, 0)
    : null
  const safeRoom = Math.max(balance - nearBills - monthlyGoalNeed, 0)
  const fitsBudget = budgetRemaining === null || amount <= budgetRemaining
  const affordable = amount <= safeRoom && fitsBudget
  const description = slots.purchaseDescription || 'pembelian ini'
  return insight({
    text: affordable
      ? `${description} seharga ${formatRupiah(amount)} masih masuk ruang aman berdasarkan data yang tercatat.`
      : `${description} seharga ${formatRupiah(amount)} belum aman untuk dibeli sekarang berdasarkan komitmen yang terlihat.`,
    facts: [
      `Posisi ${formatDate(now)}: saldo aktif ${formatRupiah(balance)}; pembayaran berulang yang diperkirakan jatuh dalam 14 hari ${formatRupiah(nearBills)}.`,
      budgetRemaining === null
        ? 'Belum ada budget kategori yang cocok untuk pembelian ini.'
        : `Sisa budget ${slots.category.name} bulan ini ${formatRupiah(budgetRemaining)}.`,
    ],
    estimates: [`Ruang belanja setelah pembayaran dekat dan laju setoran target sekitar ${formatRupiah(safeRoom)}. Pembayaran yang belum pernah dicatat belum masuk hitungan.`],
    opinions: [affordable
      ? 'Boleh dipertimbangkan selama tidak ada tagihan wajib lain yang belum dicatat.'
      : 'Tunda pembelian atau kurangi harganya agar kebutuhan wajib dan target tetap terlindungi.'],
    kind: 'affordability',
  })
}

function composeRecurringPayments({ transactions, now }) {
  const recurring = detectRecurringPayments(transactions, now)
  if (recurring.length === 0) {
    return unavailable('Belum ada pola pembayaran mingguan atau bulanan yang cukup konsisten.')
  }
  const next = recurring[0]
  const transactionDates = transactions.map(normalizeTransaction)
    .map((item) => item.occurredAt).filter(Boolean).sort((left, right) => left - right)
  return insight({
    text: `Aku menemukan ${recurring.length} pola pembayaran berulang. Yang terdekat kemungkinan ${next.description} sekitar ${formatRupiah(next.averageAmount)}.`,
    facts: [`${next.description} muncul ${next.occurrences} kali pada data ${formatPeriod(transactionDates[0] || now, transactionDates.at(-1) || now)}.`],
    estimates: [`Perkiraan berikutnya ${formatDate(next.nextExpectedAt)} berdasarkan jeda sekitar ${next.cadenceDays} hari.`],
    opinions: ['Kalau mau, buat pengingat untuk tanggal tersebut. Aku belum membuat pengingat apa pun secara otomatis.'],
    kind: 'recurring_payments',
    offerReminder: {
      description: next.description,
      expectedAt: next.nextExpectedAt,
      amount: next.averageAmount,
    },
  })
}

function composeSavingsSimulation({ slots, goals, now }) {
  const goal = slots.simulationGoal?.id
    ? goals.find((entry) => entry.id === slots.simulationGoal.id)
    : null
  const targetAmount = Number(
    slots.simulationTargetAmount || goal?.target_amount || goal?.targetAmount || 0
  )
  const currentAmount = Number(
    slots.simulationCurrentAmount ?? goal?.current_amount ?? goal?.currentAmount ?? 0
  )
  const contributionAmount = Number(slots.simulationContributionAmount || 0)
  const cadence = slots.simulationCadence || 'monthly'
  if (targetAmount <= 0) {
    return unavailable('Sebutkan nama target tersimpan atau nilai target agar simulasinya bisa dihitung.')
  }
  const simulation = simulateSavingsPlan({
    targetAmount,
    currentAmount,
    contributionAmount,
    cadence,
    startDate: now,
  })
  if (!simulation.valid) {
    return unavailable('Sebutkan nominal setoran rutin yang lebih dari nol agar simulasinya bisa dihitung.')
  }
  const cadenceLabel = cadence === 'weekly' ? 'minggu' : 'bulan'
  const goalLabel = goal?.name || slots.simulationGoal?.name || 'target ini'
  return insight({
    text: `Jika kamu menyisihkan ${formatRupiah(contributionAmount)} per ${cadenceLabel}, ${goalLabel} diperkirakan cukup pada ${formatPlanningDate(simulation.estimatedCompletionAt)}.`,
    facts: [`Target ${formatRupiah(targetAmount)}, sudah terkumpul ${formatRupiah(currentAmount)}, sehingga tersisa ${formatRupiah(simulation.remaining)}.`],
    estimates: [`Dibutuhkan ${simulation.contributionCount} setoran. Rumus: ${simulation.formula}.`],
    opinions: ['Ini simulasi tetap tanpa bunga atau perubahan nominal setoran; tidak ada transaksi yang dibuat.'],
    kind: 'savings_simulation',
    simulation,
  })
}

function composePlanningCalendar({ schedules, reminderPreferences, now }) {
  const calendar = buildPlanningCalendar(schedules, {
    preferences: reminderPreferences,
    from: now,
    days: 30,
  })
  if (calendar.length === 0) {
    return unavailable('Belum ada jadwal keuangan aktif untuk 30 hari mendatang.')
  }
  const next = calendar[0]
  const income = calendar.filter((item) => item.scheduleType === 'income')
    .reduce((sum, item) => sum + item.amount, 0)
  const outflow = calendar.filter((item) => item.scheduleType !== 'income')
    .reduce((sum, item) => sum + item.amount, 0)
  return insight({
    text: `Ada ${calendar.length} kejadian terencana dalam 30 hari. Yang terdekat: ${next.title} ${formatRupiah(next.amount)} pada ${formatPlanningDate(next.date)}.`,
    facts: [`Rencana masuk ${formatRupiah(income)} dan rencana keluar ${formatRupiah(outflow)}; selisih ${formatRupiah(income - outflow)}.`],
    estimates: [calendar.slice(0, 4).map((item) => `${formatPlanningDate(item.date)}: ${item.title} ${formatRupiah(item.amount)}`).join('; ')],
    opinions: ['Jadwal adalah proyeksi dan tidak mengubah saldo atau transaksi secara otomatis.'],
    kind: 'planning_calendar',
  })
}

function composeSavingRecommendation({ snapshot, budgets }) {
  if (!snapshot?.sourceTransactionCount) return unavailable('Data transaksi belum cukup untuk rekomendasi hemat yang personal.')
  const top = snapshot.topCategories?.[0]
  const exceeded = snapshot.budgetUsage?.filter((entry) => entry.percentage > 100) || []
  const recommendation = exceeded[0]
    ? `Hentikan sementara pengeluaran tambahan di ${exceeded[0].category} karena budget sudah ${formatPercentage(exceeded[0].percentage)} terpakai.`
    : top
      ? `Coba turunkan ${top.name} sekitar 10% atau ${formatRupiah(top.amount * 0.1)} bulan ini.`
      : 'Pertahankan pencatatan sampai pola kategori mulai terlihat.'
  return insight({
    text: recommendation,
    facts: [top ? `${top.name} adalah kategori terbesar bulan berjalan: ${formatRupiah(top.amount)}.` : `Ada ${budgets.length} budget aktif pada bulan berjalan.`],
    estimates: [top ? `Penghematan 10% pada kategori itu memberi ruang sekitar ${formatRupiah(top.amount * 0.1)}.` : 'Belum ada estimasi kategori karena data belum cukup.'],
    opinions: ['Mulai dari satu kategori terbesar agar perubahan terasa tanpa mengganggu kebutuhan utama.'],
    kind: 'saving_recommendation',
  })
}

function findCategoryAnomalies(transactions, now) {
  const currentStart = startOfWeek(now)
  const baselineStart = new Date(currentStart.getTime() - 28 * DAY_MS)
  const current = new Map()
  const baseline = new Map()
  for (const item of transactions.map(normalizeTransaction)) {
    if (item.type !== 'expense' || !item.occurredAt) continue
    const category = item.category || 'Lainnya'
    if (item.occurredAt >= currentStart && item.occurredAt <= now) {
      current.set(category, (current.get(category) || 0) + item.amount)
    } else if (item.occurredAt >= baselineStart && item.occurredAt < currentStart) {
      baseline.set(category, (baseline.get(category) || 0) + item.amount)
    }
  }
  return Array.from(current, ([category, amount]) => {
    const weeklyBaseline = (baseline.get(category) || 0) / 4
    return {
      category,
      current: amount,
      baseline: weeklyBaseline,
      changePercent: weeklyBaseline > 0 ? ((amount - weeklyBaseline) / weeklyBaseline) * 100 : 0,
    }
  }).filter((entry) => entry.baseline > 0 && entry.changePercent >= 50 && entry.current - entry.baseline >= 25_000)
    .sort((left, right) => right.changePercent - left.changePercent)
}

function detectAdviceFocus(text) {
  const normalized = normalizeLabel(text)
  if (/\b(?:jadwal|tagihan|gajian|setoran)\b.{0,45}\b(?:mendatang|berikutnya|dekat|jatuh tempo|kapan)\b|\b(?:apa|yang)\s+(?:akan|bakal)\s+(?:masuk|keluar|jatuh tempo)\b/iu.test(normalized)) return 'calendar'
  if (/\b(?:nabung|menabung|setor|sisihkan)\b.{0,50}\b(?:per|setiap|tiap)\s+(?:bulan|minggu|pekan)\b|\b(?:kapan|berapa lama)\b.{0,50}\b(?:cukup|tercapai)\b/iu.test(normalized)) return 'simulation'
  if (/\b(?:boleh|aman|mampu|cukup)\b.{0,45}\b(?:beli|bayar|ambil)\b|\b(?:beli|bayar)\b.{0,45}\b(?:boleh|aman|mampu|cukup)\b/iu.test(normalized)) return 'affordability'
  if (/\b(?:berulang|langganan|subscription|rutin)\b/iu.test(normalized)) return 'recurring'
  if (/\b(?:target|tabungan|simpanan)\b.{0,45}\b(?:kapan|tercapai|selesai|on track|sesuai jalur)\b|\b(?:kapan|prediksi)\b.{0,45}\b(?:target|tabungan)\b/iu.test(normalized)) return 'goal'
  if (/\b(?:tidak biasa|nggak biasa|naik|lonjak|boros)\b/iu.test(normalized)) return 'unusual'
  if (/\b(?:minggu|pekan|mingguan)\b/iu.test(normalized)) return 'week'
  return 'saving'
}

function applyAdviceTone(result, tone) {
  if (!result?.available || tone === 'gentle') return result
  if (tone === 'brief') {
    return { ...result, details: result.details.slice(0, 3), tone }
  }
  return {
    ...result,
    text: result.text.replace(/^Aku (?:menemukan|melihat)/u, 'Data menunjukkan'),
    tone,
  }
}

function insight({ text, facts = [], estimates = [], opinions = [], ...extra }) {
  return {
    available: true,
    text,
    details: [
      ...facts.map((value) => `Fakta — ${value}`),
      ...estimates.map((value) => `Perkiraan — ${value}`),
      ...opinions.map((value) => `Saran — ${value}`),
    ],
    evidencePeriod: facts.find((value) => value.startsWith('Periode:')) || null,
    ...extra,
  }
}

function unavailable(text) {
  return { available: false, text, details: [], kind: 'unavailable' }
}

function disabledAdvice(focus) {
  const label = {
    week: 'ringkasan mingguan', unusual: 'deteksi lonjakan', goal: 'prediksi target',
    affordability: 'penilaian pembelian', saving: 'rekomendasi hemat', recurring: 'deteksi pembayaran berulang',
    calendar: 'kalender keuangan', simulation: 'simulasi tabungan',
  }[focus] || 'saran ini'
  return unavailable(`Jenis saran ${label} sedang kamu nonaktifkan. Kamu bisa menyalakannya lagi di Pengaturan.`)
}

function normalizeTransaction(transaction) {
  const occurredAt = transaction.occurredAt || transaction.occurred_at
  return {
    type: transaction.type || transaction.transaction_type,
    amount: Number(transaction.amount || 0),
    category: transaction.category || transaction.categories?.name || null,
    merchant: transaction.merchant || null,
    description: transaction.description || transaction.desc || transaction.notes || null,
    source: transaction.source || null,
    occurredAt: occurredAt ? new Date(occurredAt) : null,
  }
}

function normalizeLabel(value) {
  return String(value || '').trim().toLocaleLowerCase('id-ID')
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function startOfWeek(value) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  return date
}

function formatPeriod(start, end) {
  const formatter = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${formatter.format(new Date(start))}–${formatter.format(new Date(end))}`
}

function formatMonth(value) {
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(value))
}

function formatDate(value) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))
}
