const DAY_MS = 24 * 60 * 60 * 1000
const AVERAGE_DAYS_PER_MONTH = 365.2425 / 12

export const REMINDER_TYPES = Object.freeze([
  'bill',
  'income',
  'goal_contribution',
])

export const DEFAULT_REMINDER_PREFERENCES = Object.freeze({
  bill: true,
  income: true,
  goal_contribution: true,
})

export function resolveReminderPreferences(rows = []) {
  return rows.reduce((preferences, row) => {
    if (REMINDER_TYPES.includes(row.reminder_type)) {
      preferences[row.reminder_type] = row.enabled !== false
    }
    return preferences
  }, { ...DEFAULT_REMINDER_PREFERENCES })
}

export function expandFinancialSchedule(schedule, {
  from = new Date(),
  days = 60,
} = {}) {
  if (!schedule?.is_active || !schedule.next_due_date) return []
  const start = startOfDay(from)
  const end = addDays(start, Math.max(Number(days || 0), 0))
  let cursor = parseDateOnly(schedule.next_due_date)
  const occurrences = []
  let guard = 0

  while (cursor <= end && guard < 400) {
    if (cursor >= start) {
      occurrences.push({
        id: `${schedule.id}:${toDateKey(cursor)}`,
        scheduleId: schedule.id,
        title: schedule.title,
        scheduleType: schedule.schedule_type,
        amount: Number(schedule.amount || 0),
        date: toDateKey(cursor),
        reminderEnabled: schedule.reminder_enabled !== false,
        cadence: schedule.cadence,
        goalId: schedule.goal_id || null,
        walletId: schedule.wallet_id || null,
        categoryId: schedule.category_id || null,
      })
    }
    if (schedule.cadence === 'once') break
    cursor = schedule.cadence === 'weekly'
      ? addDays(cursor, 7)
      : addMonthsClamped(cursor, 1)
    guard += 1
  }
  return occurrences
}

export function buildPlanningCalendar(schedules = [], {
  preferences = DEFAULT_REMINDER_PREFERENCES,
  from = new Date(),
  days = 60,
} = {}) {
  return schedules.flatMap((schedule) =>
    expandFinancialSchedule(schedule, { from, days }).map((occurrence) => ({
      ...occurrence,
      reminderActive:
        occurrence.reminderEnabled &&
        preferences[occurrence.scheduleType] !== false,
    }))
  ).sort((left, right) =>
    left.date.localeCompare(right.date) || left.title.localeCompare(right.title)
  )
}

export function summarizePlanningCalendar(occurrences = []) {
  return occurrences.reduce((summary, occurrence) => {
    const amount = Number(occurrence.amount || 0)
    if (occurrence.scheduleType === 'income') summary.income += amount
    else summary.outflow += amount
    if (occurrence.scheduleType === 'goal_contribution') summary.goalContribution += amount
    if (occurrence.reminderActive) summary.activeReminders += 1
    summary.count += 1
    return summary
  }, {
    income: 0,
    outflow: 0,
    goalContribution: 0,
    net: 0,
    activeReminders: 0,
    count: 0,
  })
}

export function finalizePlanningSummary(summary) {
  return {
    ...summary,
    net: Number(summary.income || 0) - Number(summary.outflow || 0),
  }
}

export function calculateIncomeAllocation({
  monthlyIncome,
  needsPercent,
  savingsPercent,
  debtPercent,
  freePercent,
} = {}) {
  const income = Number(monthlyIncome || 0)
  const percentages = {
    needs: Number(needsPercent || 0),
    savings: Number(savingsPercent || 0),
    debt: Number(debtPercent || 0),
    free: Number(freePercent || 0),
  }
  const totalPercent = Object.values(percentages).reduce((sum, value) => sum + value, 0)
  const valid = Number.isFinite(income) && income > 0 &&
    Object.values(percentages).every((value) => Number.isFinite(value) && value >= 0 && value <= 100) &&
    Math.abs(totalPercent - 100) < 0.001

  return {
    valid,
    monthlyIncome: income,
    percentages,
    totalPercent,
    amounts: Object.fromEntries(
      Object.entries(percentages).map(([key, percent]) => [key, income * percent / 100])
    ),
    formula: `${formatNumber(income)} × persentase ÷ 100`,
  }
}

export function simulateSavingsPlan({
  targetAmount,
  currentAmount = 0,
  contributionAmount,
  cadence = 'monthly',
  startDate = new Date(),
} = {}) {
  const target = Number(targetAmount || 0)
  const current = Math.max(Number(currentAmount || 0), 0)
  const contribution = Number(contributionAmount || 0)
  const remaining = Math.max(target - current, 0)
  const validCadence = ['weekly', 'monthly'].includes(cadence)
  const valid = Number.isFinite(target) && target > 0 &&
    Number.isFinite(contribution) && contribution > 0 && validCadence

  if (!valid) {
    return {
      valid: false,
      targetAmount: target,
      currentAmount: current,
      contributionAmount: contribution,
      cadence,
      remaining,
      contributionCount: null,
      estimatedCompletionAt: null,
      formula: null,
      mutatesTransactions: false,
    }
  }

  const contributionCount = Math.ceil(remaining / contribution)
  const completion = cadence === 'weekly'
    ? addDays(startOfDay(startDate), contributionCount * 7)
    : addMonthsClamped(startOfDay(startDate), contributionCount)
  const averageMonthlyContribution = cadence === 'weekly'
    ? contribution * AVERAGE_DAYS_PER_MONTH / 7
    : contribution

  return {
    valid: true,
    targetAmount: target,
    currentAmount: current,
    contributionAmount: contribution,
    cadence,
    remaining,
    contributionCount,
    averageMonthlyContribution,
    estimatedCompletionAt: completion.toISOString(),
    formula: `ceil((${formatNumber(target)} - ${formatNumber(current)}) ÷ ${formatNumber(contribution)}) = ${contributionCount} setoran`,
    mutatesTransactions: false,
  }
}

export function formatPlanningDate(value) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

function parseDateOnly(value) {
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

function startOfDay(value) {
  const date = new Date(value)
  date.setHours(12, 0, 0, 0)
  return date
}

function addDays(value, days) {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date
}

function addMonthsClamped(value, months) {
  const original = new Date(value)
  const day = original.getDate()
  const target = new Date(original.getFullYear(), original.getMonth() + months, 1, 12)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(day, lastDay))
  return target
}

function toDateKey(value) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value)
}
