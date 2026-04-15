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
    }
  }

  return {
    title: directFrom ? `Transfer dari ${directFrom}` : 'Transfer Masuk',
    subtitle: directFrom
      ? `Masuk ke ${walletName || 'dompet tujuan'}`
      : walletName
        ? `Masuk ke ${walletName}`
        : 'Transfer masuk',
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
  }
}

function buildGoalWithdrawalPresentation({ merchant, walletName }) {
  const goalName =
    merchant.match(/^pencairan\s+(.+?)(?:\s+ke\s+.+)?$/i)?.[1]?.trim() ||
    merchant.replace(/^pencairan\s+/i, '').trim()

  return {
    title: goalName ? `Pencairan ${goalName}` : 'Pencairan Tabungan',
    subtitle: walletName ? `Ke ${walletName}` : 'Dana dicairkan',
  }
}

function buildGoalRefundPresentation({ merchant, walletName }) {
  const goalName =
    merchant.match(/^pengembalian\s+(.+?)(?:\s+ke\s+.+)?$/i)?.[1]?.trim() ||
    merchant.replace(/^pengembalian\s+/i, '').trim()

  return {
    title: goalName ? `Pengembalian ${goalName}` : 'Dana Dikembalikan',
    subtitle: walletName ? `Ke ${walletName}` : 'Dana kembali',
  }
}

function buildRegularPresentation({ merchant, notes, transactionType, categoryName }) {
  const cleanedLabel = cleanFreeformLabel(merchant || notes, {
    categoryName,
  })

  const fallbackTitle = transactionType === 'income'
    ? 'Pemasukan'
    : categoryName && categoryName !== 'Lainnya'
      ? `Pengeluaran ${categoryName}`
      : 'Pengeluaran'

  return {
    title: cleanedLabel || fallbackTitle,
    subtitle: categoryName && categoryName !== 'Lainnya'
      ? categoryName
      : transactionType === 'income'
        ? 'Pemasukan'
        : 'Pengeluaran',
  }
}

function cleanFreeformLabel(value, { categoryName = '' } = {}) {
  const normalizedCategoryWords = tokenizePlainText(categoryName)
  const removableWords = new Set([
    ...FILLER_WORDS,
    ...normalizedCategoryWords,
  ])

  const words = tokenizeRawText(value).filter((word) => {
    const lower = word.toLowerCase()
    return !removableWords.has(lower) && !MONEY_WORDS.has(lower) && !/^\d+$/.test(lower)
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

function tokenizePlainText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
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
