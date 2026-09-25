export const REPORT_LIMIT = 10000
export const reportMoney = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 2,
  }).format(value / 100)
export const reportDate = (value) =>
  new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
export const currentReportMonth = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7)
export const BUCKET_LABELS = {
  income: 'Pemasukan',
  expense: 'Pengeluaran',
  savings: 'Tabungan',
  internal_transfer: 'Transfer internal',
  opening_balance: 'Saldo awal',
}

export function reportPeriod(month) {
  if (month === 'all')
    return { month, start: null, end: null, label: 'Seluruh periode' }
  if (typeof month !== 'string' || !/^(20\d{2})-(0[1-9]|1[0-2])$/.test(month))
    throw Object.assign(new Error('Pilih bulan laporan yang valid.'), {
      statusCode: 400,
    })
  const [year, number] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, number - 1, 1, -7)).toISOString()
  const end = new Date(Date.UTC(year, number, 1, -7)).toISOString()
  return {
    month,
    start,
    end,
    label: new Intl.DateTimeFormat('id-ID', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(start)),
  }
}

function cents(value) {
  const match = String(value).match(/^(\d+)(?:\.(\d{1,2}))?$/)
  if (!match)
    throw new Error('Nominal transaksi tidak valid; laporan tidak diterbitkan.')
  const result =
    Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'))
  if (!Number.isSafeInteger(result))
    throw new Error('Nominal melewati batas perhitungan aman.')
  return result
}
const generic =
  /^(?:lainnya|lainya|other|misc|expense|pengeluaran|income|pemasukan|transaction|transaksi|umum|general)$/i

export function buildFinancialReport(
  rows,
  month,
  generatedAt = new Date().toISOString()
) {
  const period = reportPeriod(month)
  if (rows.length > REPORT_LIMIT)
    throw Object.assign(
      new Error(
        'Transaksi melebihi 10.000 baris. Pilih satu bulan untuk laporan lengkap.'
      ),
      { statusCode: 422 }
    )
  const totals = {
    income: 0,
    expense: 0,
    savingIn: 0,
    savingOut: 0,
    transfer: 0,
    opening: 0,
  }
  const groups = new Map()
  let unclassified = 0
  let ordinaryCount = 0
  const transactions = rows.map((row) => {
    const amount = cents(row.amount)
    const type = row.transaction_type
    if (!['income', 'expense'].includes(type))
      throw new Error('Jenis transaksi tidak valid.')
    const source = String(row.source || '').toLowerCase()
    const bucket =
      row.analytics_bucket ||
      ([
        'goal_contribution',
        'goal_initial_contribution',
        'goal_refund',
        'goal_withdrawal',
      ].includes(source)
        ? 'savings'
        : source === 'transfer'
          ? 'internal_transfer'
          : source === 'wallet_opening_balance'
            ? 'opening_balance'
            : type)
    if (!BUCKET_LABELS[bucket])
      throw new Error('Kelompok transaksi tidak valid.')
    if (!Number.isFinite(Date.parse(row.occurred_at)))
      throw new Error('Tanggal transaksi tidak valid.')
    const ordinary = bucket === 'income' || bucket === 'expense'
    const validCategory =
      row.category_name &&
      !generic.test(row.category_name.trim()) &&
      ['both', type].includes(row.category_type)
    const category = ordinary
      ? validCategory
        ? row.category_name
        : 'Belum dikategorikan'
      : BUCKET_LABELS[bucket]
    if (ordinary) {
      ordinaryCount++
      if (!validCategory) unclassified++
      totals[bucket] += amount
      const key = `${bucket}:${category}`
      const group = groups.get(key) || {
        name: category,
        type: bucket,
        amount: 0,
        count: 0,
      }
      group.amount += amount
      group.count++
      groups.set(key, group)
    } else if (bucket === 'savings')
      totals[type === 'expense' ? 'savingIn' : 'savingOut'] += amount
    else if (bucket === 'internal_transfer' && type === 'expense')
      totals.transfer += amount
    else if (bucket === 'opening_balance')
      totals.opening += type === 'income' ? amount : -amount
    return {
      id: row.id,
      amount,
      type,
      bucket,
      category,
      needsCategory: ordinary && !validCategory,
      categoryId: row.category_id,
      walletId: row.wallet_id,
      canEdit:
        ordinary && ['chat', 'manual', 'ocr', 'app', ''].includes(source),
      description: row.merchant || row.notes || 'Tanpa keterangan',
      notes: row.notes || '',
      wallet: row.wallet_name || 'Dompet tidak tersedia',
      occurredAt: row.occurred_at,
    }
  })
  totals.operatingNet = totals.income - totals.expense
  totals.savingsNet = totals.savingIn - totals.savingOut
  totals.afterSavings = totals.operatingNet - totals.savingsNet
  if (Object.values(totals).some((value) => !Number.isSafeInteger(value)))
    throw new Error('Total melewati batas perhitungan aman.')
  const categories = [...groups.values()].sort(
    (a, b) => b.amount - a.amount || a.name.localeCompare(b.name)
  )
  const largest = categories.find((group) => group.type === 'expense')
  const insights = [
    rows.length
      ? `Setelah uang masuk dan keluar, kamu ${totals.operatingNet >= 0 ? 'masih punya sisa' : 'mengeluarkan lebih banyak'} ${reportMoney(Math.abs(totals.operatingNet))}.`
      : 'Belum ada transaksi pada periode ini.',
    ...(largest
      ? [
          `Pengeluaran terbesar: ${largest.name}, ${reportMoney(largest.amount)} (${totals.expense ? Math.round((largest.amount / totals.expense) * 100) : 0}% dari pengeluaran).`,
        ]
      : []),
    unclassified
      ? `${unclassified} transaksi perlu ditinjau kategorinya. Total nominal tetap termasuk dalam laporan.`
      : 'Semua transaksi pemasukan/pengeluaran memiliki kategori spesifik.',
  ]
  return {
    period,
    generatedAt,
    totals,
    categories,
    transactions,
    unclassified,
    ordinaryCount,
    insights,
  }
}
