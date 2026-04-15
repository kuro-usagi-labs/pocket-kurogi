import { supabase } from './supabase'

/**
 * Analyze user text for transaction/advice intents.
 * Fast-path regex stays on the client for simple commands.
 * Complex prompts and OCR are delegated to a Supabase Edge Function
 * so the Gemini API key is not shipped to the browser.
 */
export async function analyzeTransaction(
  text,
  imageBase64 = null,
  walletNames = [],
  financialContext = '',
  goalNames = []
) {
  if (imageBase64) {
    return callAnalyzerFunction(text, imageBase64, walletNames, financialContext)
  }

  const regexResult = analyzeWithRegex(text || '', walletNames, goalNames)
  if (regexResult.type !== 'unknown') {
    return regexResult
  }

  try {
    return await callAnalyzerFunction(text, null, walletNames, financialContext)
  } catch (error) {
    console.error('Analyzer backend error:', error)
    return regexResult
  }
}

async function callAnalyzerFunction(text, imageBase64, walletNames, financialContext) {
  const { data, error } = await supabase.functions.invoke('analyze-transaction', {
    body: {
      text,
      imageBase64,
      walletNames,
      financialContext,
    },
  })

  if (error) {
    throw error
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Analyzer response was empty.')
  }

  return data
}

function analyzeWithRegex(text, walletNames, goalNames) {
  let normalizedText = text.toLowerCase().trim()
  const analyticsQuery = detectAnalyticsQuery(normalizedText)

  const goalWithdrawal = detectGoalWithdrawal(normalizedText, walletNames, goalNames)
  if (goalWithdrawal) {
    return goalWithdrawal
  }

  if (!analyticsQuery && /(tabungan|milestone|target)/i.test(normalizedText)) {
    return {
      type: 'unknown',
      reply: 'Kalau ingin mengatur target, tulis dengan format seperti "tabung 200k untuk dana darurat" atau "buat target laptop 12jt".',
    }
  }

  if (/^(halo|hai|hi|hey|pagi|siang|sore|malam)/.test(normalizedText) && !/\d/.test(normalizedText)) {
    return {
      type: 'greeting',
      reply: 'Sistem aktif. Silakan instruksikan pencatatan pengeluaran atau pemasukan Anda hari ini.',
    }
  }

  if (/^(ya|iy|yes|ok|siap|betul|benar)$/i.test(normalizedText)) {
    return { type: 'confirm' }
  }

  if (/^(tidak|gak|no|batal|cancel|nggak)$/i.test(normalizedText)) {
    return { type: 'cancel' }
  }

  if (/hapus semua (wallet|dompet|rekening)/i.test(normalizedText)) {
    return { type: 'bulk_delete_wallets' }
  }

  if (/hapus (semua )?riwayat/i.test(normalizedText)) {
    return { type: 'bulk_delete_transactions' }
  }

  const deleteWalletMatch = normalizedText.match(
    /^(?:hapus|buang|delete|hilangkan)\s+(?:dompet|rekening|wallet)\s+([a-z0-9]+)/i
  )

  if (deleteWalletMatch) {
    return {
      type: 'delete_wallet',
      wallet: deleteWalletMatch[1],
    }
  }

  if (
    !/(pengeluaran|pemasukan|tabungan|cashflow|arus kas|transfer)/i.test(normalizedText) &&
    (
      /^(cek|berapa|lihat|tampilkan)\s+(saldo|sisa|uang|total)/i.test(normalizedText) ||
    /saldo \w+ berapa/i.test(normalizedText)
    )
  ) {
    const walletMatch = walletNames.find((wallet) => normalizedText.includes(wallet.toLowerCase()))
    return {
      type: 'check_balance',
      target: walletMatch || 'all',
    }
  }

  if (analyticsQuery) {
    return analyticsQuery
  }

  const transferIntent = detectTransfer(normalizedText, walletNames)
  if (transferIntent) {
    return transferIntent
  }

  if (/^(buat|bikin|tambah|create)\s+(dompet|rekening|wallet)/i.test(normalizedText)) {
    const moneyMatch = normalizedText.match(/(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta|m)?/i)
    let initialBalance = 0

    if (moneyMatch) {
      let parsed = parseFloat(moneyMatch[1].replace(',', '.'))
      const multiplier = moneyMatch[2]
      if (['k', 'rb', 'ribu'].includes(multiplier)) parsed *= 1000
      else if (['jt', 'juta'].includes(multiplier)) parsed *= 1000000
      else if (parsed > 0 && parsed < 1000) parsed *= 1000
      initialBalance = parsed
    }

    const nameMatch = text.match(
      /(?:dompet|rekening|wallet)\s+([a-zA-Z0-9\s]+?)(?:\s+(?:isi|saldo|dengan|sebesar)\s*|\s*$|\s+(?:rp\s*)?(?:\d+))/i
    )

    let name = 'Dompet Baru'
    if (nameMatch?.[1]) {
      name = nameMatch[1].replace(/^(isi|saldo|sebesar|rp|dengan)\s+/i, '').trim()
      name = name.replace(/\s+\d.*/, '').trim()
      name = name.charAt(0).toUpperCase() + name.slice(1)
    }

    return {
      type: 'create_wallet',
      name,
      initial_balance: initialBalance,
      wallet_type: 'bank',
      reply: `Siap, dompet ${name} akan segera dibuat dengan saldo awal.`,
    }
  }

  normalizedText = normalizedText.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2')
  normalizedText = normalizedText.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2')

  const moneyRegex = /(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta|m)?/i
  const match = normalizedText.match(moneyRegex)

  if (!match) {
    return {
      type: 'unknown',
      reply: 'Sistem membutuhkan nominal spesifik untuk memproses ledger. Contoh: "Beli kopi 50k tunai"',
    }
  }

  let amount = parseFloat(match[1].replace(',', '.'))
  const multiplier = match[2]

  if (multiplier) {
    if (['k', 'rb', 'ribu'].includes(multiplier)) amount *= 1000
    else if (['jt', 'juta'].includes(multiplier)) amount *= 1000000
    else if (multiplier === 'm') amount *= 1000000000
  } else if (amount > 0 && amount < 1000) {
    amount *= 1000
  }

  const allWallets = [...walletNames.map((wallet) => wallet.toLowerCase()), 'tunai', 'cash']
  const walletRegex = new RegExp(`\\b(${allWallets.join('|')})\\b`, 'i')
  let walletMatch = normalizedText.match(walletRegex)?.[1]?.toLowerCase()

  if (walletMatch === 'cash') walletMatch = 'tunai'

  if (!walletMatch) {
    const prepositionMatch = normalizedText.match(/(?:ke|di|dari|pakai|pake|bank)\s+([a-z0-9]+)/i)
    if (prepositionMatch) {
      walletMatch = prepositionMatch[1]
    } else {
      const words = normalizedText.split(/\s+/)
      const lastWord = words[words.length - 1]
      const categories = ['makan', 'minum', 'kopi', 'bensin', 'transport', 'belanja', 'gaji', 'bonus', 'jajan', 'listrik']
      if (lastWord && lastWord.length > 2 && !categories.includes(lastWord) && !lastWord.match(/\d/)) {
        walletMatch = lastWord
      }
    }
  }

  const wallet = walletMatch || (walletNames.length > 0 ? walletNames[0].toLowerCase() : 'tunai')

  const category =
    normalizedText.match(/\b(kopi|makan|minum|bensin|transport|belanja|gaji|bonus|jajan|listrik)\b/i)?.[1]?.toLowerCase() ||
    'lainnya'

  let desc = text.replace(match[0], '').trim()
  desc = desc.replace(new RegExp(`\\b${wallet}\\b`, 'i'), '')
  desc = desc.replace(new RegExp(`\\b${category}\\b`, 'i'), '')
  desc = desc.replace(/^(beli|bayar|buat|dari|terima|dapat|pake|pakai|-|\+)\s+/gi, '').trim()
  if (!desc) desc = category.charAt(0).toUpperCase() + category.slice(1)

  const isIncome = /(gaji|dapat|terima|masuk|bonus|topup|pemasukan|tambah|plus|add|\+)/i.test(normalizedText)
  const isExplicitExpense = /(beli|bayar|keluar|tarif|biaya|spent|-\s*\d)/i.test(normalizedText)
  const hasLowConfidence =
    !isIncome && !isExplicitExpense && category === 'lainnya' && !normalizedText.match(walletRegex)

  if (hasLowConfidence) {
    return {
      type: 'unknown',
      reply: 'Formatnya belum cukup jelas. Coba tulis seperti "beli kopi 25k tunai", "gaji 5jt BCA", atau "transfer 100k dari BCA ke OVO".',
    }
  }

  return {
    type: 'transaction',
    transactionType: isIncome ? 'income' : 'expense',
    amount,
    desc: desc.charAt(0).toUpperCase() + desc.slice(1),
    category,
    wallet,
  }
}

function detectAnalyticsQuery(normalizedText) {
  if (!normalizedText) {
    return null
  }

  if (/(tips|saran|strategi|rekomendasi|optimalkan|hemat|improve|perbaiki|solusi|bantu saya atur)/i.test(normalizedText)) {
    return null
  }

  const metric = detectAnalyticsMetric(normalizedText)

  if (!metric) {
    return null
  }

  return {
    type: 'analytics_query',
    metric,
    period: detectAnalyticsPeriod(normalizedText),
  }
}

function detectAnalyticsMetric(normalizedText) {
  if (/(paling boros|boros di mana|pengeluaran terbesar|kategori terbesar|spending terbesar|paling banyak habis)/i.test(normalizedText)) {
    return 'top_expense'
  }

  if (/(pemasukan terbesar|uang masuk terbesar|income terbesar|masuk paling banyak dari mana|sumber pemasukan terbesar)/i.test(normalizedText)) {
    return 'top_income'
  }

  if (/(total pengeluaran|pengeluaran berapa|keluar berapa|habis berapa|expense berapa)/i.test(normalizedText)) {
    return 'total_expense'
  }

  if (/(total pemasukan|pemasukan berapa|uang masuk berapa|income berapa|masuk berapa)/i.test(normalizedText)) {
    return 'total_income'
  }

  if (/(tabungan berapa|sudah nabung berapa|alokasi tabungan|savings berapa|berapa yang disisihkan)/i.test(normalizedText)) {
    return 'total_savings'
  }

  if (/(cashflow|arus kas|net cashflow|saldo bersih|sisa bersih)/i.test(normalizedText)) {
    return 'net_cashflow'
  }

  if (/(transfer berapa|total transfer|volume transfer)/i.test(normalizedText)) {
    return 'transfer_volume'
  }

  if (/(ringkas|ringkasan|summary|overview|laporan|kondisi keuangan|kondisi uang|situasi keuangan|gimana keuangan|bagaimana keuangan|rekap keuangan)/i.test(normalizedText)) {
    return 'overview'
  }

  return null
}

function detectAnalyticsPeriod(normalizedText) {
  if (/(hari ini|today)/i.test(normalizedText)) {
    return 'today'
  }

  if (/(minggu ini|pekan ini|7 hari terakhir|seminggu terakhir)/i.test(normalizedText)) {
    return 'this_week'
  }

  if (/(bulan ini|month to date|mtd)/i.test(normalizedText)) {
    return 'this_month'
  }

  if (/(30 hari|30 hari terakhir|sebulan terakhir)/i.test(normalizedText)) {
    return 'last_30_days'
  }

  return 'all_time'
}

function detectGoalWithdrawal(normalizedText, walletNames, goalNames) {
  if (!/(cairkan|cairin|tarik|ambil)/i.test(normalizedText)) {
    return null
  }

  const goalName = findMatchingEntityName(normalizedText, goalNames)
  if (!goalName) {
    return {
      type: 'unknown',
      reply: 'Kalau ingin mencairkan target, tulis seperti "cairkan 200k dari dana darurat ke tunai".',
    }
  }

  const moneyMatch = normalizedText.match(/(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta|m)?/i)
  if (!moneyMatch) {
    return {
      type: 'unknown',
      reply: `Saya belum melihat nominal pencairannya. Coba tulis seperti "cairkan 200k dari ${goalName} ke tunai".`,
    }
  }

  let amount = parseFloat(moneyMatch[1].replace(',', '.'))
  const multiplier = moneyMatch[2]

  if (multiplier) {
    if (['k', 'rb', 'ribu'].includes(multiplier)) amount *= 1000
    else if (['jt', 'juta'].includes(multiplier)) amount *= 1000000
    else if (multiplier === 'm') amount *= 1000000000
  } else if (amount > 0 && amount < 1000) {
    amount *= 1000
  }

  const destinationWallet = findMatchingEntityName(normalizedText, walletNames) || 'Tunai'

  return {
    type: 'goal_withdrawal',
    goalName,
    amount,
    wallet: destinationWallet,
    reply: `Siap, saya akan mencairkan dana dari target ${goalName} ke ${destinationWallet}.`,
  }
}

function detectTransfer(normalizedText, walletNames) {
  if (!/(transfer|pindah(?:kan)?|kirim(?:kan)?)/i.test(normalizedText)) {
    return null
  }

  const moneyMatch = normalizedText.match(/(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta|m)?/i)
  if (!moneyMatch) {
    return {
      type: 'unknown',
      reply: 'Kalau ingin transfer, tulis nominalnya juga. Contoh: "transfer 100k dari BCA ke DANA".',
    }
  }

  let amount = parseFloat(moneyMatch[1].replace(',', '.'))
  const multiplier = moneyMatch[2]

  if (multiplier) {
    if (['k', 'rb', 'ribu'].includes(multiplier)) amount *= 1000
    else if (['jt', 'juta'].includes(multiplier)) amount *= 1000000
    else if (multiplier === 'm') amount *= 1000000000
  } else if (amount > 0 && amount < 1000) {
    amount *= 1000
  }

  const fromWallet = findEntityAfterKeyword(normalizedText, walletNames, 'dari')
  const toWallet = findEntityAfterKeyword(normalizedText, walletNames, 'ke')
  const mentions = findMentionedEntityNames(normalizedText, walletNames)

  const resolvedFrom = fromWallet || mentions[0] || null
  const resolvedTo =
    toWallet ||
    mentions.find((name) => name && name.toLowerCase() !== String(resolvedFrom || '').toLowerCase()) ||
    null

  if (!resolvedFrom || !resolvedTo) {
    return {
      type: 'unknown',
      reply: 'Format transfernya belum lengkap. Coba tulis seperti "transfer 100k dari BCA ke DANA".',
    }
  }

  if (resolvedFrom.toLowerCase() === resolvedTo.toLowerCase()) {
    return {
      type: 'unknown',
      reply: 'Dompet asal dan tujuan transfer tidak boleh sama. Contoh yang benar: "transfer 100k dari BCA ke DANA".',
    }
  }

  return {
    type: 'transfer',
    amount,
    from: resolvedFrom,
    to: resolvedTo,
    reply: `Siap, saya akan memindahkan ${formatAmount(amount)} dari ${resolvedFrom} ke ${resolvedTo}.`,
  }
}

function findMatchingEntityName(normalizedText, names = []) {
  return [...names]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .find((name) => normalizedText.includes(name.toLowerCase())) || null
}

function findEntityAfterKeyword(normalizedText, names = [], keyword) {
  return [...names]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .find((name) => {
      const escapedName = escapeRegex(name.toLowerCase())
      return new RegExp(`\\b${keyword}\\s+${escapedName}\\b`, 'i').test(normalizedText)
    }) || null
}

function findMentionedEntityNames(normalizedText, names = []) {
  return [...names]
    .filter(Boolean)
    .map((name) => ({
      name,
      index: normalizedText.indexOf(name.toLowerCase()),
    }))
    .filter((entry) => entry.index >= 0)
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.name)
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function formatAmount(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
