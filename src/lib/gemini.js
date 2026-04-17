import { supabase } from './supabase'
import {
  findOptionAfterKeyword,
  formatCandidateNames,
  matchMoney,
  normalizeEntityName,
  normalizeNumericText,
  parseMoneyMatch,
  resolveOptionByIdOrName,
  resolveOptionReference,
} from './chatEntities'

const TRANSACTION_CATEGORIES = [
  'makan',
  'minum',
  'kopi',
  'bensin',
  'transport',
  'belanja',
  'gaji',
  'bonus',
  'jajan',
  'listrik',
]

/**
 * Analyze user text for transaction/advice intents.
 * Fast-path regex stays on the client for simple commands.
 * Complex prompts and OCR are delegated to a Supabase Edge Function
 * so the Gemini API key is not shipped to the browser.
 */
export async function analyzeTransaction(
  text,
  imageBase64 = null,
  walletOptions = [],
  goalOptions = [],
  financialContext = ''
) {
  if (imageBase64) {
    return callAnalyzerFunction(text, imageBase64, walletOptions, goalOptions, financialContext)
  }

  const regexResult = analyzeWithRegex(text || '', walletOptions, goalOptions)
  if (regexResult.type !== 'unknown') {
    return regexResult
  }

  try {
    return await callAnalyzerFunction(text, null, walletOptions, goalOptions, financialContext)
  } catch (error) {
    console.error('Analyzer backend error:', error)
    return regexResult
  }
}

async function callAnalyzerFunction(text, imageBase64, walletOptions, goalOptions, financialContext) {
  const { data, error } = await supabase.functions.invoke('analyze-transaction', {
    body: {
      text,
      imageBase64,
      walletOptions,
      goalOptions,
      financialContext,
    },
  })

  if (error) {
    throw error
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Analyzer response was empty.')
  }

  return normalizeAnalysisResult(data, walletOptions, goalOptions, text)
}

function analyzeWithRegex(text, walletOptions, goalOptions = []) {
  let normalizedText = normalizeNumericText(text.toLowerCase().trim())
  const analyticsQuery = detectAnalyticsQuery(normalizedText)

  const goalWithdrawal = detectGoalWithdrawalIntent(normalizedText, walletOptions, goalOptions)
  if (goalWithdrawal) {
    return goalWithdrawal
  }

  const goalContribution = detectGoalContributionIntent(normalizedText, walletOptions, goalOptions)
  if (goalContribution) {
    return goalContribution
  }

  const walletTransfer = detectWalletTransferIntent(normalizedText, walletOptions)
  if (walletTransfer) {
    return walletTransfer
  }

  if (!analyticsQuery && /(tabungan|milestone|target)/i.test(normalizedText)) {
    return { type: 'unknown' }
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
    /^(?:hapus|buang|delete|hilangkan)\s+(?:dompet|rekening|wallet)\s+(.+)$/i
  )

  if (deleteWalletMatch?.[1]) {
    const walletResolution = resolveOptionReference({
      input: deleteWalletMatch[1],
      options: walletOptions,
    })

    if (walletResolution.match) {
      return {
        type: 'delete_wallet',
        walletId: walletResolution.match.id,
        wallet: walletResolution.match.name,
      }
    }
  }

  if (
    !/(pengeluaran|pemasukan|tabungan|cashflow|arus kas|transfer)/i.test(normalizedText) &&
    (/^(cek|berapa|lihat|tampilkan)\s+(saldo|sisa|uang|total)/i.test(normalizedText) ||
      /saldo .+ berapa/i.test(normalizedText))
  ) {
    const resolution = resolveOptionReference({
      input: normalizedText,
      options: walletOptions,
    })

    return {
      type: 'check_balance',
      target: resolution.match?.name || 'all',
      targetWalletId: resolution.match?.id || null,
    }
  }

  if (analyticsQuery) {
    return analyticsQuery
  }

  if (/^(buat|bikin|tambah|create)\s+(dompet|rekening|wallet)/i.test(normalizedText)) {
    const moneyMatch = matchMoney(normalizedText)
    const initialBalance = moneyMatch ? parseMoneyMatch(moneyMatch) : 0

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

  const amountMatch = matchMoney(normalizedText)

  if (!amountMatch) {
    return {
      type: 'unknown',
      reply: 'Sistem membutuhkan nominal spesifik untuk memproses ledger. Contoh: "Beli kopi 50k tunai"',
    }
  }

  const amount = parseMoneyMatch(amountMatch)
  const walletResolution = resolveWalletForTransaction(normalizedText, walletOptions)
  const category =
    normalizedText.match(/\b(kopi|makan|minum|bensin|transport|belanja|gaji|bonus|jajan|listrik)\b/i)?.[1]?.toLowerCase() ||
    'lainnya'

  let desc = text.replace(amountMatch[0], '').trim()
  const resolvedWalletName = walletResolution.match?.name || walletResolution.walletName || null
  if (resolvedWalletName) {
    desc = desc.replace(new RegExp(`\\b${escapeRegExp(resolvedWalletName)}\\b`, 'i'), '')
  }
  desc = desc.replace(new RegExp(`\\b${category}\\b`, 'i'), '')
  desc = desc.replace(/^(beli|bayar|buat|dari|terima|dapat|pake|pakai|-|\+)\s+/gi, '').trim()
  if (/^(dari|ke|pakai|pake|via|bank)$/i.test(desc)) {
    desc = ''
  }
  if (!desc) desc = category.charAt(0).toUpperCase() + category.slice(1)

  const isIncome = /(gaji|dapat|terima|masuk|bonus|topup|pemasukan|tambah|plus|add|\+)/i.test(normalizedText)
  const isExplicitExpense = /(beli|bayar|keluar|tarif|biaya|spent|-\s*\d)/i.test(normalizedText)
  const wallet = walletResolution.match
  const hasLowConfidence =
    !isIncome && !isExplicitExpense && category === 'lainnya' && !wallet

  if (hasLowConfidence) {
    return { type: 'unknown' }
  }

  if (walletResolution.type === 'needs_confirmation') {
    return {
      ...walletResolution,
      intent: {
        ...(walletResolution.intent || {}),
        type: 'transaction',
        transactionType: isIncome ? 'income' : 'expense',
        amount,
        desc: desc.charAt(0).toUpperCase() + desc.slice(1),
        category,
      },
    }
  }

  return {
    type: 'transaction',
    transactionType: isIncome ? 'income' : 'expense',
    amount,
    desc: desc.charAt(0).toUpperCase() + desc.slice(1),
    category,
    wallet: wallet?.name || null,
    walletId: wallet?.id || null,
  }
}

function detectGoalContributionIntent(normalizedText, walletOptions = [], goalOptions = []) {
  const mentionsGoal = /(tabung|nabung|setor|sisih|simpan|alokasi|masukin|masukkan)/i.test(normalizedText)
  if (!mentionsGoal) {
    return null
  }

  const goalResolution = findOptionAfterKeyword({
    text: normalizedText,
    options: goalOptions,
    keywords: ['ke', 'buat', 'untuk', 'target', 'tabungan', 'goal', 'milestone'],
  })

  if (!goalResolution.match) {
    return null
  }

  const amountMatch = matchMoney(normalizedText)
  if (!amountMatch) {
    return null
  }

  const sourceResolution = findOptionAfterKeyword({
    text: normalizedText,
    options: walletOptions,
    keywords: ['dari', 'pakai', 'pake', 'via'],
    stopKeywords: ['ke', 'buat', 'untuk', 'target', 'tabungan', 'goal', 'milestone'],
  })

  if (!sourceResolution.match) {
    if (sourceResolution.reason === 'ambiguous') {
      return createNeedsConfirmation({
        reason: 'ambiguous_wallet',
        prompt: `Dompet sumber untuk setoran goal belum jelas. Pilih salah satu: ${formatCandidateNames(sourceResolution.candidates)}.`,
        candidates: sourceResolution.candidates,
        intent: {
          type: 'goal_contribution',
          goalId: goalResolution.match.id,
          goal: goalResolution.match.name,
          amount: parseMoneyMatch(amountMatch),
        },
      })
    }

    const rawWalletName = extractRawReferenceAfterKeyword(normalizedText, ['dari', 'pakai', 'pake', 'via'])
    if (rawWalletName) {
      return createNeedsConfirmation({
        reason: 'unknown_wallet',
        prompt: `Dompet "${rawWalletName}" belum ada. Buat wallet baru dengan nama itu?`,
        action: 'create_wallet',
        walletName: rawWalletName,
        intent: {
          type: 'goal_contribution',
          goalId: goalResolution.match.id,
          goal: goalResolution.match.name,
          amount: parseMoneyMatch(amountMatch),
          sourceWallet: rawWalletName,
        },
      })
    }

    if (walletOptions.length === 1) {
      sourceResolution.match = walletOptions[0]
    } else {
      return createNeedsConfirmation({
        reason: 'missing_source_wallet',
        prompt: `Setoran untuk target ${goalResolution.match.name} perlu dompet sumber. Pilih salah satu: ${formatCandidateNames(walletOptions)}.`,
        candidates: walletOptions,
        intent: {
          type: 'goal_contribution',
          goalId: goalResolution.match.id,
          goal: goalResolution.match.name,
          amount: parseMoneyMatch(amountMatch),
        },
      })
    }
  }

  return {
    type: 'goal_contribution',
    goalId: goalResolution.match.id,
    goal: goalResolution.match.name,
    amount: parseMoneyMatch(amountMatch),
    sourceWalletId: sourceResolution.match.id,
    sourceWallet: sourceResolution.match.name,
    reply: `Siap, saya akan memindahkan dana dari ${sourceResolution.match.name} ke target ${goalResolution.match.name}.`,
  }
}

function detectGoalWithdrawalIntent(normalizedText, walletOptions = [], goalOptions = []) {
  const mentionsGoal = /(tabungan|goal|milestone|target)/i.test(normalizedText)
  const mentionsWithdrawal = /(transfer|pindah|tarik|ambil|cair|keluarkan|balikin|kembalikan)/i.test(normalizedText)

  if (!mentionsGoal || !mentionsWithdrawal) {
    return null
  }

  const goalResolution = resolveOptionReference({
    input: normalizedText,
    options: goalOptions,
  })

  if (!goalResolution.match) {
    return null
  }

  const destinationResolution = findOptionAfterKeyword({
    text: normalizedText,
    options: walletOptions,
    keywords: ['ke', 'ke dompet', 'ke rekening', 'ke wallet'],
  })

  if (!destinationResolution.match) {
    if (destinationResolution.reason === 'ambiguous') {
      return createNeedsConfirmation({
        reason: 'ambiguous_wallet',
        prompt: `Dompet tujuan untuk pencairan ${goalResolution.match.name} belum jelas. Pilih salah satu: ${formatCandidateNames(destinationResolution.candidates)}.`,
        candidates: destinationResolution.candidates,
        intent: {
          type: 'goal_withdrawal',
          goalId: goalResolution.match.id,
          goal: goalResolution.match.name,
          amount: parseMoneyMatch(matchMoney(normalizedText)),
          unresolvedRole: 'destination',
        },
      })
    }

    const rawWalletName = extractRawReferenceAfterKeyword(normalizedText, ['ke'])
    if (rawWalletName) {
      return createNeedsConfirmation({
        reason: 'unknown_wallet',
        prompt: `Dompet "${rawWalletName}" belum ada. Buat wallet baru dengan nama itu?`,
        action: 'create_wallet',
        walletName: rawWalletName,
        intent: {
          type: 'goal_withdrawal',
          goalId: goalResolution.match.id,
          goal: goalResolution.match.name,
          amount: parseMoneyMatch(matchMoney(normalizedText)),
          destinationWalletName: rawWalletName,
        },
      })
    }

    return null
  }

  const amountMatch = matchMoney(normalizedText)
  if (!amountMatch) {
    return null
  }

  return {
    type: 'goal_withdrawal',
    goalId: goalResolution.match.id,
    goal: goalResolution.match.name,
    amount: parseMoneyMatch(amountMatch),
    destinationWalletId: destinationResolution.match.id,
    wallet: destinationResolution.match.name,
    reply: `Siap, saya akan memindahkan dana dari tabungan ${goalResolution.match.name} ke dompet ${destinationResolution.match.name}.`,
  }
}

function detectWalletTransferIntent(normalizedText, walletOptions = []) {
  if (!/(transfer|pindah|geser|kirim)/i.test(normalizedText)) {
    return null
  }

  const sourceResolution = findOptionAfterKeyword({
    text: normalizedText,
    options: walletOptions,
    keywords: ['dari'],
    stopKeywords: ['ke'],
  })
  const destinationResolution = findOptionAfterKeyword({
    text: normalizedText,
    options: walletOptions,
    keywords: ['ke'],
  })

  const amountMatch = matchMoney(normalizedText)
  if (!amountMatch) {
    return null
  }

  if (!sourceResolution.match || !destinationResolution.match) {
    const missingWalletName =
      extractRawReferenceAfterKeyword(normalizedText, ['dari']) ||
      extractRawReferenceAfterKeyword(normalizedText, ['ke'])

    if (missingWalletName) {
      return createNeedsConfirmation({
        reason: 'unknown_wallet',
        prompt: `Dompet "${missingWalletName}" belum ada. Buat wallet baru dengan nama itu?`,
        action: 'create_wallet',
        walletName: missingWalletName,
        intent: {
          type: 'transfer',
          fromWalletId: sourceResolution.match?.id || null,
          from: sourceResolution.match?.name || null,
          toWalletId: destinationResolution.match?.id || null,
          to: destinationResolution.match?.name || null,
          unresolvedWalletName: missingWalletName,
          unresolvedRole: sourceResolution.match ? 'destination' : 'source',
          amount: parseMoneyMatch(amountMatch),
        },
      })
    }

    const candidateList = sourceResolution.candidates.length > 0
      ? sourceResolution.candidates
      : destinationResolution.candidates

    if (candidateList.length > 0) {
      return createNeedsConfirmation({
        reason: 'ambiguous_wallet',
        prompt: `Transfer antar dompet belum jelas. Kandidat yang cocok: ${formatCandidateNames(candidateList)}.`,
        candidates: candidateList,
        intent: {
          type: 'transfer',
          fromWalletId: sourceResolution.match?.id || null,
          from: sourceResolution.match?.name || null,
          toWalletId: destinationResolution.match?.id || null,
          to: destinationResolution.match?.name || null,
          unresolvedRole: sourceResolution.match ? 'destination' : 'source',
          amount: parseMoneyMatch(amountMatch),
        },
      })
    }

    return null
  }

  return {
    type: 'transfer',
    amount: parseMoneyMatch(amountMatch),
    from: sourceResolution.match.name,
    fromWalletId: sourceResolution.match.id,
    to: destinationResolution.match.name,
    toWalletId: destinationResolution.match.id,
    reply: `Siap, saya akan memindahkan dana dari ${sourceResolution.match.name} ke ${destinationResolution.match.name}.`,
  }
}

function resolveWalletForTransaction(normalizedText, walletOptions) {
  const walletResolution = resolveOptionReference({
    input: normalizedText,
    options: walletOptions,
  })

  if (walletResolution.match) {
    return walletResolution
  }

  if (walletResolution.candidates.length > 0) {
    return createNeedsConfirmation({
      reason: 'ambiguous_wallet',
      prompt: `Dompet untuk transaksi ini belum jelas. Pilih salah satu: ${formatCandidateNames(walletResolution.candidates)}.`,
      candidates: walletResolution.candidates,
    })
  }

  const rawWalletName =
    extractRawReferenceAfterKeyword(normalizedText, ['dari', 'pakai', 'pake', 'via', 'bank']) ||
    extractPotentialTrailingWalletName(normalizedText)

  if (rawWalletName) {
    return createNeedsConfirmation({
      reason: 'unknown_wallet',
      prompt: `Dompet "${rawWalletName}" belum ada. Buat wallet baru dengan nama itu?`,
      action: 'create_wallet',
      walletName: rawWalletName,
      intent: {
        type: 'transaction',
        originalText: normalizedText,
      },
    })
  }

  if (walletOptions.length === 1) {
    return {
      match: walletOptions[0],
      candidates: [walletOptions[0]],
      reason: 'single',
    }
  }

  return createNeedsConfirmation({
    reason: 'missing_wallet',
    prompt: `Dompet untuk transaksi ini belum disebutkan. Pilih salah satu: ${formatCandidateNames(walletOptions)}.`,
    candidates: walletOptions,
  })
}

function normalizeAnalysisResult(analysis, walletOptions, goalOptions, rawText) {
  if (!analysis || typeof analysis !== 'object') {
    return {
      type: 'unknown',
      reply: 'Analisa tidak menghasilkan payload yang valid.',
    }
  }

  if (analysis.type === 'transaction') {
    const walletResolution = resolveOptionByIdOrName({
      id: analysis.walletId,
      name: analysis.wallet,
      options: walletOptions,
    })

    if (walletResolution.match) {
      return {
        ...analysis,
        walletId: walletResolution.match.id,
        wallet: walletResolution.match.name,
      }
    }

    if (analysis.wallet) {
      return createNeedsConfirmation({
        reason: 'unknown_wallet',
        prompt: `Dompet "${analysis.wallet}" belum ada. Buat wallet baru dengan nama itu?`,
        action: 'create_wallet',
        walletName: analysis.wallet,
        intent: {
          ...analysis,
        },
      })
    }

    return resolveWalletForTransaction(normalizeNumericText(String(rawText || '').toLowerCase()), walletOptions)
  }

  if (analysis.type === 'transfer') {
    const fromResolution = resolveOptionByIdOrName({
      id: analysis.fromWalletId,
      name: analysis.from,
      options: walletOptions,
    })
    const toResolution = resolveOptionByIdOrName({
      id: analysis.toWalletId,
      name: analysis.to,
      options: walletOptions,
    })

    if (fromResolution.match && toResolution.match) {
      return {
        ...analysis,
        fromWalletId: fromResolution.match.id,
        from: fromResolution.match.name,
        toWalletId: toResolution.match.id,
        to: toResolution.match.name,
      }
    }

    if (analysis.from && !fromResolution.match) {
      return createNeedsConfirmation({
        reason: 'unknown_wallet',
        prompt: `Dompet "${analysis.from}" belum ada. Buat wallet baru dengan nama itu?`,
        action: 'create_wallet',
        walletName: analysis.from,
        intent: {
          ...analysis,
          unresolvedRole: 'source',
        },
      })
    }

    if (analysis.to && !toResolution.match) {
      return createNeedsConfirmation({
        reason: 'unknown_wallet',
        prompt: `Dompet "${analysis.to}" belum ada. Buat wallet baru dengan nama itu?`,
        action: 'create_wallet',
        walletName: analysis.to,
        intent: {
          ...analysis,
          unresolvedRole: 'destination',
        },
      })
    }
  }

  if (analysis.type === 'goal_contribution') {
    const goalResolution = resolveOptionByIdOrName({
      id: analysis.goalId,
      name: analysis.goal || analysis.name,
      options: goalOptions,
    })
    const sourceResolution = resolveOptionByIdOrName({
      id: analysis.sourceWalletId || analysis.walletId,
      name: analysis.sourceWallet || analysis.wallet,
      options: walletOptions,
    })

    if (goalResolution.match && sourceResolution.match) {
      return {
        ...analysis,
        goalId: goalResolution.match.id,
        goal: goalResolution.match.name,
        sourceWalletId: sourceResolution.match.id,
        sourceWallet: sourceResolution.match.name,
      }
    }

    if (goalResolution.match && !sourceResolution.match) {
      if (analysis.sourceWallet || analysis.wallet) {
        return createNeedsConfirmation({
          reason: 'unknown_wallet',
          prompt: `Dompet "${analysis.sourceWallet || analysis.wallet}" belum ada. Buat wallet baru dengan nama itu?`,
          action: 'create_wallet',
          walletName: analysis.sourceWallet || analysis.wallet,
          intent: {
            ...analysis,
          },
        })
      }

      if (walletOptions.length === 1) {
        return {
          ...analysis,
          goalId: goalResolution.match.id,
          goal: goalResolution.match.name,
          sourceWalletId: walletOptions[0].id,
          sourceWallet: walletOptions[0].name,
        }
      }

      return createNeedsConfirmation({
        reason: 'missing_source_wallet',
        prompt: `Setoran untuk target ${goalResolution.match.name} perlu dompet sumber. Pilih salah satu: ${formatCandidateNames(walletOptions)}.`,
        candidates: walletOptions,
        intent: {
          ...analysis,
          goalId: goalResolution.match.id,
          goal: goalResolution.match.name,
        },
      })
    }
  }

  if (analysis.type === 'goal_withdrawal') {
    const goalResolution = resolveOptionByIdOrName({
      id: analysis.goalId,
      name: analysis.goal || analysis.name,
      options: goalOptions,
    })
    const destinationResolution = resolveOptionByIdOrName({
      id: analysis.destinationWalletId || analysis.walletId,
      name: analysis.wallet,
      options: walletOptions,
    })

    if (goalResolution.match && destinationResolution.match) {
      return {
        ...analysis,
        goalId: goalResolution.match.id,
        goal: goalResolution.match.name,
        destinationWalletId: destinationResolution.match.id,
        wallet: destinationResolution.match.name,
      }
    }

    if (goalResolution.match && analysis.wallet && !destinationResolution.match) {
      return createNeedsConfirmation({
        reason: 'unknown_wallet',
        prompt: `Dompet "${analysis.wallet}" belum ada. Buat wallet baru dengan nama itu?`,
        action: 'create_wallet',
        walletName: analysis.wallet,
        intent: {
          ...analysis,
        },
      })
    }

    if (goalResolution.match && !destinationResolution.match) {
      return createNeedsConfirmation({
        reason: 'missing_wallet',
        prompt: `Dompet tujuan untuk pencairan ${goalResolution.match.name} perlu dipilih. Pilih salah satu: ${formatCandidateNames(walletOptions)}.`,
        candidates: walletOptions,
        intent: {
          ...analysis,
          goalId: goalResolution.match.id,
          goal: goalResolution.match.name,
          unresolvedRole: 'destination',
        },
      })
    }
  }

  return analysis
}

function createNeedsConfirmation({
  reason,
  prompt,
  action = null,
  walletName = null,
  intent = null,
  candidates = [],
}) {
  return {
    type: 'needs_confirmation',
    reason,
    prompt,
    action,
    walletName,
    intent,
    candidates,
  }
}

function extractRawReferenceAfterKeyword(text, keywords = []) {
  const normalizedText = normalizeEntityName(text)

  for (const keyword of keywords) {
    const regex = new RegExp(`${escapeRegExp(normalizeEntityName(keyword))}\\s+([a-z0-9][a-z0-9\\s-]*)$`, 'i')
    const match = normalizedText.match(regex)
    if (match?.[1]) {
      const candidate = match[1]
        .replace(/\b(rp\s*)?\d.*$/i, '')
        .trim()

      if (candidate) {
        return candidate
      }
    }
  }

  return null
}

function extractPotentialTrailingWalletName(text) {
  const words = normalizeEntityName(text).split(/\s+/)
  const lastTwo = words.slice(-2).join(' ').trim()
  const lastOne = words.slice(-1).join(' ').trim()
  const candidates = [lastTwo, lastOne]

  for (const candidate of candidates) {
    if (
      candidate &&
      !TRANSACTION_CATEGORIES.includes(candidate) &&
      !/\d/.test(candidate)
    ) {
      return candidate
    }
  }

  return null
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

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
