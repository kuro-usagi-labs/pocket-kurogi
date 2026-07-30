const FILLER_WORDS = new Set([
  'tambahkan',
  'tambah',
  'pemasukan',
  'pengeluaran',
  'transaksi',
  'alokasi',
  'diproses',
  'dari',
  'ke',
  'di',
  'untuk',
  'menggunakan',
  'pakai',
  'pake',
  'dengan',
  'pada',
  'sebagai',
  'catatan',
  'tadi',
  'beli',
  'membeli',
  'bayar',
  'membayar',
  'saldo',
  'dompet',
  'wallet',
  'rekening',
  'masuk',
  'keluar',
  'tambahan',
])

const MONEY_WORDS = new Set(['rp', 'idr', 'k', 'rb', 'ribu', 'jt', 'juta', 'm'])

export function buildHistoryPresentation({
  merchant = '',
  notes = '',
  source = '',
  transactionType = '',
  walletName = '',
  categoryName = '',
}) {
  const normalizedSource = String(source || '').toLowerCase()
  const normalizedType = String(transactionType || '').toLowerCase()
  const rawLabel = String(merchant || notes || '').trim()

  if (normalizedSource === 'transfer') {
    return buildTransferPresentation({ merchant: rawLabel, transactionType: normalizedType, walletName })
  }

  if (normalizedSource === 'goal_contribution') {
    return buildGoalContributionPresentation({ merchant: rawLabel, walletName, initial: false })
  }

  if (normalizedSource === 'goal_initial_contribution') {
    return buildGoalContributionPresentation({ merchant: rawLabel, walletName, initial: true })
  }

  if (normalizedSource === 'goal_withdrawal') {
    return buildGoalWithdrawalPresentation({ merchant: rawLabel, walletName })
  }

  if (normalizedSource === 'goal_refund') {
    return buildGoalRefundPresentation({ merchant: rawLabel, walletName })
  }

  if (normalizedSource === 'wallet_opening_balance') {
    return {
      title: `Saldo Awal ${walletName || 'Dompet'}`,
      subtitle: 'Saldo awal',
      iconKey: 'wallet_opening_balance',
    }
  }

  return buildRegularPresentation({
    merchant: rawLabel,
    notes,
    transactionType: normalizedType,
    categoryName,
  })
}

function buildTransferPresentation({ merchant, transactionType, walletName }) {
  const directTo = merchant.match(/\bke\s+(.+)$/i)?.[1]?.trim() || ''
  const directFrom =
    merchant.match(/\bdari\s+(.+?)(?:\s+ke\s+.+)?$/i)?.[1]?.trim() ||
    merchant.match(/^transfer\s+(.+?)(?:\s+ke\s+.+)?$/i)?.[1]?.trim() ||
    ''

  if (transactionType === 'expense') {
    return {
      title: directTo ? `Transfer ke ${directTo}` : 'Transfer Keluar',
      subtitle: walletName ? `Dari ${walletName}` : 'Transfer keluar',
      iconKey: 'transfer_out',
    }
  }

  return {
    title: directFrom ? `Transfer dari ${directFrom}` : 'Transfer Masuk',
    subtitle: directFrom
      ? `Masuk ke ${walletName || 'dompet tujuan'}`
      : walletName
        ? `Masuk ke ${walletName}`
        : 'Transfer masuk',
    iconKey: 'transfer_in',
  }
}

function buildGoalContributionPresentation({ merchant, walletName, initial }) {
  const goalName =
    merchant.match(/^setoran\s+awal\s+target\s+(.+)$/i)?.[1]?.trim() ||
    merchant.match(/^setoran\s+target\s+(.+)$/i)?.[1]?.trim() ||
    merchant.replace(/^setoran\s+/i, '').trim()

  return {
    title: goalName ? `${initial ? 'Setoran Awal' : 'Setoran'} ${goalName}` : initial ? 'Setoran Awal Target' : 'Setoran Target',
    subtitle: walletName ? `Dari ${walletName}` : 'Alokasi tabungan',
    iconKey: initial ? 'goal_initial_contribution' : 'goal_contribution',
  }
}

function buildGoalWithdrawalPresentation({ merchant, walletName }) {
  const goalName =
    merchant.match(/^pencairan\s+(.+?)(?:\s+ke\s+.+)?$/i)?.[1]?.trim() ||
    merchant.replace(/^pencairan\s+/i, '').trim()

  return {
    title: goalName ? `Pencairan ${goalName}` : 'Pencairan Tabungan',
    subtitle: walletName ? `Ke ${walletName}` : 'Dana dicairkan',
    iconKey: 'goal_withdrawal',
  }
}

function buildGoalRefundPresentation({ merchant, walletName }) {
  const goalName =
    merchant.match(/^pengembalian\s+(.+?)(?:\s+ke\s+.+)?$/i)?.[1]?.trim() ||
    merchant.replace(/^pengembalian\s+/i, '').trim()

  return {
    title: goalName ? `Pengembalian ${goalName}` : 'Dana Dikembalikan',
    subtitle: walletName ? `Ke ${walletName}` : 'Dana kembali',
    iconKey: 'goal_refund',
  }
}

function buildRegularPresentation({ merchant, notes, transactionType, categoryName }) {
  const cleanedLabel = cleanFreeformLabel(merchant || notes)

  const fallbackTitle = transactionType === 'income'
    ? 'Pemasukan'
    : categoryName && categoryName !== 'Lainnya'
      ? `Pengeluaran ${categoryName}`
      : 'Pengeluaran'

  return {
    title: cleanedLabel || fallbackTitle,
    subtitle:
      categoryName &&
      categoryName !== 'Lainnya' &&
      normalizeForLookup(cleanedLabel) !== normalizeForLookup(categoryName)
      ? categoryName
      : transactionType === 'income'
        ? 'Pemasukan'
        : 'Pengeluaran',
    iconKey: inferRegularIconKey({
      title: cleanedLabel || fallbackTitle,
      notes,
      transactionType,
      categoryName,
    }),
  }
}

function inferRegularIconKey({ title = '', notes = '', transactionType = '', categoryName = '' }) {
  const haystack = normalizeForLookup([title, notes, categoryName].filter(Boolean).join(' '))

  if (transactionType === 'income') {
    if (/\b(gaji|salary|payroll|kantor|client|proyek|freelance|fee|komisi)\b/.test(haystack)) {
      return 'income_salary'
    }

    if (/\b(bonus|thr|gift|hadiah|reward|cashback)\b/.test(haystack)) {
      return 'income_bonus'
    }

    return 'income_general'
  }

  if (/\b(kopi|coffee|cafe|minum)\b/.test(haystack)) {
    return 'expense_coffee'
  }

  if (/\b(makan|food|gofood|grabfood|resto|restoran|warteg|bakso|mie|nasi)\b/.test(haystack)) {
    return 'expense_food'
  }

  if (/\b(jajan|snack|camilan|roti|pizza|burger)\b/.test(haystack)) {
    return 'expense_snack'
  }

  if (/\b(belanja|shopping|mart|store|toko|supermarket|minimarket|alfamart|indomaret)\b/.test(haystack)) {
    return 'expense_shopping'
  }

  if (/\b(transport|bensin|bbm|parkir|ojek|grab|gocar|gojek|taxi|bus|kereta)\b/.test(haystack)) {
    return 'expense_transport'
  }

  if (/\b(travel|pesawat|flight|hotel|liburan)\b/.test(haystack)) {
    return 'expense_travel'
  }

  if (/\b(listrik|air|wifi|internet|tagihan|pln)\b/.test(haystack)) {
    return 'expense_bills'
  }

  if (/\b(rumah|kos|kontrakan|sewa|rent)\b/.test(haystack)) {
    return 'expense_home'
  }

  if (/\b(pulsa|paket|data|dana|ovo|gopay|shopeepay|topup)\b/.test(haystack)) {
    return 'expense_digital'
  }

  if (/\b(obat|dokter|klinik|rs|rumah sakit|kesehatan)\b/.test(haystack)) {
    return 'expense_health'
  }

  return 'expense_general'
}

function cleanFreeformLabel(value) {
  const words = tokenizeRawText(value).filter((word) => {
    const lower = word.toLowerCase()
    return !FILLER_WORDS.has(lower) && !MONEY_WORDS.has(lower) && !/^\d+$/.test(lower)
  })

  if (words.length === 0) {
    return ''
  }

  return formatWordSequence(words)
}

function tokenizeRawText(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
}

function normalizeForLookup(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatWordSequence(words) {
  return words
    .map((word) => formatSingleWord(word))
    .join(' ')
}

function formatSingleWord(word) {
  const trimmed = String(word || '').trim()
  if (!trimmed) {
    return ''
  }

  if (/^[A-Z0-9]{2,6}$/.test(trimmed)) {
    return trimmed
  }

  if (/^[a-z0-9]{2,6}$/.test(trimmed) && isLikelyAcronym(trimmed)) {
    return trimmed.toUpperCase()
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
}

function isLikelyAcronym(word) {
  return ['bca', 'bri', 'bni', 'ovo', 'dana', 'gopay', 'qris'].includes(String(word).toLowerCase())
}
