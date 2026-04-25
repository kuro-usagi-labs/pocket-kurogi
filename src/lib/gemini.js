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
import { inferCategoryFromText, normalizeCategoryLookup } from './categoryCatalog'

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

const LEDGER_AMOUNT_REQUIRED_REPLY =
  'Saya perlu nominal yang jelas. Contoh: "Beli kopi 50k tunai".'
const GENERIC_UNKNOWN_REPLY =
  'Saya belum bisa memetakan permintaan itu ke aksi yang aman. Coba minta analisis keuangan, cek ringkasan, atau tulis transaksi dengan nominal yang jelas.'
const TRANSFER_INTENT_PATTERN = /\b(transfer|trf|tf|trasfer|tranfer|pindah|pindahin|geser|kirim|kirimkan|oper|mutasi|move)\b/i

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
  categoryOptions = [],
  financialContext = '',
  learningContext = {}
) {
  const archivedWalletOptions = learningContext?.archivedWalletOptions || []

  if (imageBase64) {
    return callAnalyzerFunction(
      text,
      imageBase64,
      walletOptions,
      archivedWalletOptions,
      goalOptions,
      categoryOptions,
      financialContext
    )
  }

  const regexResult = analyzeWithRegex(text || '', walletOptions, goalOptions, archivedWalletOptions)
  if (regexResult.type !== 'unknown') {
    if (shouldEscalateTransactionCategory(regexResult, text, learningContext)) {
      try {
        const analyzerResult = await callAnalyzerFunction(
          text,
          null,
          walletOptions,
          archivedWalletOptions,
          goalOptions,
          categoryOptions,
          financialContext
        )

        if (analyzerResult?.type === 'transaction') {
          return analyzerResult
        }
      } catch (error) {
        console.error('Analyzer category escalation failed:', error)
      }
    }

    return regexResult
  }

  try {
    return await callAnalyzerFunction(
      text,
      null,
      walletOptions,
      archivedWalletOptions,
      goalOptions,
      categoryOptions,
      financialContext
    )
  } catch (error) {
    console.error('Analyzer backend error:', error)
    return regexResult
  }
}

async function callAnalyzerFunction(
  text,
  imageBase64,
  walletOptions,
  archivedWalletOptions,
  goalOptions,
  categoryOptions,
  financialContext
) {
  const { supabase } = await import('./supabase')
  const { data, error } = await supabase.functions.invoke('analyze-transaction', {
    body: {
      text,
      imageBase64,
      walletOptions,
      archivedWalletOptions,
      goalOptions,
      categoryOptions,
      financialContext,
    },
  })

  if (error) {
    throw error
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Analyzer response was empty.')
  }

  return normalizeAnalysisResult(data, walletOptions, archivedWalletOptions, goalOptions, text)
}

export function analyzeWithRegex(text, walletOptions, goalOptions = [], archivedWalletOptions = []) {
  let normalizedText = normalizeIntentText(normalizeNumericText(text.toLowerCase().trim()))
  const analyticsQuery = detectAnalyticsQuery(normalizedText)
  const adviceQuery = detectAdviceQuery(normalizedText)

  if (adviceQuery) {
    return adviceQuery
  }

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

  if (/^(?:hapus|buang|delete|hilangkan)\s+(?:dompet|rekening|wallet)\s*$/i.test(normalizedText)) {
    return createNeedsConfirmation({
      reason: 'missing_wallet',
      prompt: `Dompet mana yang ingin dihapus? Pilih salah satu: ${formatCandidateNames(walletOptions)}.`,
      candidates: walletOptions,
      intent: {
        type: 'delete_wallet',
      },
    })
  }

  const renameWalletMatch = text.trim().match(
    /^(?:rename|ganti(?:\s+nama)?|ubah(?:\s+nama)?)\s+(?:dompet|rekening|wallet)\s+(.+?)\s+(?:menjadi|jadi|ke)\s+(.+)$/i
  )

  if (renameWalletMatch?.[1] && renameWalletMatch?.[2]) {
    const nextName = cleanEntityText(renameWalletMatch[2])
    const walletResolution = resolveOptionReference({
      input: renameWalletMatch[1],
      options: walletOptions,
    })

    if (walletResolution.match) {
      return {
        type: 'rename_wallet',
        walletId: walletResolution.match.id,
        wallet: walletResolution.match.name,
        nextName,
      }
    }

    if (walletResolution.candidates.length > 0) {
      return createNeedsConfirmation({
        reason: 'ambiguous_wallet',
        prompt: `Dompet yang ingin diubah namanya belum jelas. Pilih salah satu: ${formatCandidateNames(walletResolution.candidates)}.`,
        candidates: walletResolution.candidates,
        intent: {
          type: 'rename_wallet',
          nextName,
        },
      })
    }

    return createNeedsConfirmation({
      reason: 'missing_wallet',
      prompt: `Dompet mana yang ingin diubah menjadi **${nextName}**? Pilih salah satu: ${formatCandidateNames(walletOptions)}.`,
      candidates: walletOptions,
      intent: {
        type: 'rename_wallet',
        nextName,
      },
    })
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

    if (walletResolution.candidates.length > 0) {
      return createNeedsConfirmation({
        reason: 'ambiguous_wallet',
        prompt: `Dompet yang ingin dihapus belum jelas. Pilih salah satu: ${formatCandidateNames(walletResolution.candidates)}.`,
        candidates: walletResolution.candidates,
        intent: {
          type: 'delete_wallet',
        },
      })
    }

    return createNeedsConfirmation({
      reason: 'missing_wallet',
      prompt: `Saya belum menemukan dompet itu. Pilih salah satu dompet aktif Anda: ${formatCandidateNames(walletOptions)}.`,
      candidates: walletOptions,
      intent: {
        type: 'delete_wallet',
      },
    })
  }

  const restoreWalletMatch = normalizedText.match(
    /^(?:pulihkan|kembalikan|restore|aktifkan\s+kembali)\s+(?:dompet|rekening|wallet)\s+(.+)$/i
  )

  if (restoreWalletMatch?.[1]) {
    const walletResolution = resolveOptionReference({
      input: restoreWalletMatch[1],
      options: archivedWalletOptions,
    })

    if (walletResolution.match) {
      return {
        type: 'restore_wallet',
        walletId: walletResolution.match.id,
        wallet: walletResolution.match.name,
      }
    }

    if (walletResolution.candidates.length > 0) {
      return createNeedsConfirmation({
        reason: 'ambiguous_wallet',
        prompt: `Dompet arsip yang ingin dipulihkan belum jelas. Pilih salah satu: ${formatCandidateNames(walletResolution.candidates)}.`,
        candidates: walletResolution.candidates,
        intent: {
          type: 'restore_wallet',
        },
      })
    }

    return createNeedsConfirmation({
      reason: 'missing_wallet',
      prompt: `Saya belum menemukan dompet arsip itu. Pilih salah satu dompet arsip Anda: ${formatCandidateNames(archivedWalletOptions)}.`,
      candidates: archivedWalletOptions,
      intent: {
        type: 'restore_wallet',
      },
    })
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
      reply: buildUnknownReply(normalizedText),
    }
  }

  const amount = parseMoneyMatch(amountMatch)
  const walletResolution = resolveWalletForTransaction(normalizedText, walletOptions)
  const isIncome = /(gaji|dapat|terima|masuk|bonus|topup|pemasukan|tambah|plus|add|\+|dividen|bunga)/i.test(normalizedText)
  const inferredCategory = inferCategoryFromText({
    text: normalizedText,
    transactionType: isIncome ? 'income' : 'expense',
  })
  const category = inferredCategory.categoryName
    ? normalizeCategoryLookup(inferredCategory.categoryName)
    : 'lainnya'

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
        prompt: `Dompet "${rawWalletName}" belum ada. Buat dompet baru?`,
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
        prompt: `Dompet "${rawWalletName}" belum ada. Buat dompet baru?`,
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
  if (!TRANSFER_INTENT_PATTERN.test(normalizedText)) {
    return null
  }

  const sourceResolution = findOptionAfterKeyword({
    text: normalizedText,
    options: walletOptions,
    keywords: ['dari', 'dr', 'asal', 'sumber', 'from', 'pakai', 'pake', 'via'],
    stopKeywords: ['ke', 'tujuan', 'menuju', 'to'],
  })
  const destinationResolution = findOptionAfterKeyword({
    text: normalizedText,
    options: walletOptions,
    keywords: ['ke', 'tujuan', 'menuju', 'to'],
  })

  const amountMatch = matchMoney(normalizedText)
  if (!amountMatch) {
    return createNeedsConfirmation({
      reason: 'missing_amount',
      prompt: buildTransferGuide({
        intro: 'Saya menangkap ini sebagai transfer antar dompet, tapi nominalnya belum jelas.',
        walletOptions,
      }),
      candidates: walletOptions,
      intent: {
        type: 'transfer',
        fromWalletId: sourceResolution.match?.id || null,
        from: sourceResolution.match?.name || null,
        toWalletId: destinationResolution.match?.id || null,
        to: destinationResolution.match?.name || null,
      },
    })
  }

  if (!sourceResolution.match || !destinationResolution.match) {
    const missingSourceName = !sourceResolution.match
      ? extractRawReferenceAfterKeyword(normalizedText, ['dari', 'dr', 'asal', 'sumber', 'from', 'pakai', 'pake', 'via'])
      : ''
    const missingDestinationName = !destinationResolution.match
      ? extractRawReferenceAfterKeyword(normalizedText, ['ke', 'tujuan', 'menuju', 'to'])
      : ''
    const missingWalletName = missingSourceName || missingDestinationName

    if (missingWalletName) {
      return createNeedsConfirmation({
        reason: 'unknown_wallet',
        prompt: buildTransferGuide({
          intro: `Saya belum menemukan dompet "${missingWalletName}". Mungkin ada typo, atau dompetnya belum dibuat.`,
          walletOptions,
        }),
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
        prompt: buildTransferGuide({
          intro: `Saya mendeteksi kemungkinan typo/kemiripan nama dompet. Kandidat yang cocok: ${formatCandidateNames(candidateList)}.`,
          walletOptions,
        }),
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

    return createNeedsConfirmation({
      reason: 'missing_transfer_wallet',
      prompt: buildTransferGuide({
        intro: 'Transfer antar dompet butuh dompet asal dan tujuan yang jelas.',
        walletOptions,
      }),
      candidates: walletOptions,
      intent: {
        type: 'transfer',
        fromWalletId: sourceResolution.match?.id || null,
        from: sourceResolution.match?.name || null,
        toWalletId: destinationResolution.match?.id || null,
        to: destinationResolution.match?.name || null,
        amount: parseMoneyMatch(amountMatch),
      },
    })
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
      prompt: `Saya mendeteksi kemungkinan typo/kemiripan nama dompet. Pilih yang benar: ${formatCandidateNames(walletResolution.candidates)}.`,
      candidates: walletResolution.candidates,
    })
  }

  const rawWalletName =
    extractRawReferenceAfterKeyword(normalizedText, ['dari', 'pakai', 'pake', 'via', 'bank']) ||
    extractPotentialTrailingWalletName(normalizedText)

  if (rawWalletName) {
    return createNeedsConfirmation({
      reason: 'unknown_wallet',
      prompt: `Dompet "${rawWalletName}" belum ada. Buat dompet baru?`,
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

function normalizeAnalysisResult(analysis, walletOptions, archivedWalletOptions, goalOptions, rawText) {
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
        prompt: `Dompet "${analysis.wallet}" belum ada. Buat dompet baru?`,
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
        prompt: `Dompet "${analysis.from}" belum ada. Buat dompet baru?`,
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
        prompt: `Dompet "${analysis.to}" belum ada. Buat dompet baru?`,
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
          prompt: `Dompet "${analysis.sourceWallet || analysis.wallet}" belum ada. Buat dompet baru?`,
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
        prompt: `Dompet "${analysis.wallet}" belum ada. Buat dompet baru?`,
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

  if (analysis.type === 'delete_wallet') {
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

    return createNeedsConfirmation({
      reason: 'missing_wallet',
      prompt: `Dompet yang ingin dihapus belum jelas. Pilih salah satu: ${formatCandidateNames(walletOptions)}.`,
      candidates: walletOptions,
      intent: {
        ...analysis,
      },
    })
  }

  if (analysis.type === 'rename_wallet') {
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
        nextName: cleanEntityText(analysis.nextName),
      }
    }

    return createNeedsConfirmation({
      reason: 'missing_wallet',
      prompt: `Dompet yang ingin diubah belum jelas. Pilih salah satu: ${formatCandidateNames(walletOptions)}.`,
      candidates: walletOptions,
      intent: {
        ...analysis,
        nextName: cleanEntityText(analysis.nextName),
      },
    })
  }

  if (analysis.type === 'restore_wallet') {
    const walletResolution = resolveOptionByIdOrName({
      id: analysis.walletId,
      name: analysis.wallet,
      options: archivedWalletOptions,
    })

    if (walletResolution.match) {
      return {
        ...analysis,
        walletId: walletResolution.match.id,
        wallet: walletResolution.match.name,
      }
    }

    return createNeedsConfirmation({
      reason: 'missing_wallet',
      prompt: `Dompet arsip yang ingin dipulihkan belum jelas. Pilih salah satu: ${formatCandidateNames(archivedWalletOptions)}.`,
      candidates: archivedWalletOptions,
      intent: {
        ...analysis,
      },
    })
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

function cleanEntityText(value = '') {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function detectAnalyticsQuery(normalizedText) {
  if (!normalizedText) {
    return null
  }

  if (detectAdviceQuery(normalizedText)) {
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

export function detectAdviceQuery(normalizedText) {
  if (!normalizedText) {
    return null
  }

  if (!/(tips|tip|saran|strategi|rekomendasi|optimalkan|hemat|improve|perbaiki|solusi|bantu saya atur|langkah terbaik|apa yang harus saya lakukan)/i.test(normalizedText)) {
    return null
  }

  return {
    type: 'advice',
    period: detectAnalyticsPeriod(normalizedText),
    focus: detectAdviceFocus(normalizedText),
  }
}

export function detectAdviceFocus(normalizedText) {
  if (/(pengeluaran|boros|hemat|spending|expense|belanja)/i.test(normalizedText)) {
    return 'expense'
  }

  if (/(pemasukan|income|penghasilan|pendapatan|gaji|bonus)/i.test(normalizedText)) {
    return 'income'
  }

  if (/(tabungan|saving|savings|sisih|milestone|goal|target)/i.test(normalizedText)) {
    return 'savings'
  }

  if (/(budget|anggaran|limit)/i.test(normalizedText)) {
    return 'budget'
  }

  return 'overall'
}

function detectAnalyticsMetric(normalizedText) {
  if (/(paling boros|boros di mana|pengeluaran terbesar|kategori terbesar|spending terbesar|paling banyak habis)/i.test(normalizedText)) {
    return 'top_expense'
  }

  if (/(pemasukan terbesar|uang masuk terbesar|income terbesar|masuk paling banyak dari mana|sumber pemasukan terbesar)/i.test(normalizedText)) {
    return 'top_income'
  }

  if (/(total pengeluaran|berapa pengeluaran|pengeluaran(?: [a-z0-9]+){0,4} berapa|keluar berapa|habis berapa|expense berapa)/i.test(normalizedText)) {
    return 'total_expense'
  }

  if (/(total pemasukan|berapa pemasukan|pemasukan(?: [a-z0-9]+){0,4} berapa|uang masuk berapa|income berapa|masuk berapa)/i.test(normalizedText)) {
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

function buildUnknownReply(normalizedText) {
  if (!normalizedText) {
    return GENERIC_UNKNOWN_REPLY
  }

  if (/(bagaimana|gimana|kenapa|mengapa|apa|tolong|bisakah|bisa|boleh|analisa|analisis|sarankan|strategi|ringkas|ringkasan)/i.test(normalizedText)) {
    return GENERIC_UNKNOWN_REPLY
  }

  if (TRANSFER_INTENT_PATTERN.test(normalizedText)) {
    return [
      'Saya menangkap ini sebagai transfer antar dompet, tapi detailnya belum lengkap.',
      'Format aman: "transfer 100rb dari BCA ke DANA".',
      'Sebutkan nominal, dompet asal, dan dompet tujuan.',
    ].join('\n')
  }

  if (/(beli|bayar|keluar|masuk|gaji|bonus|topup|tabung|nabung|setor|cair|tarik|pindah)/i.test(normalizedText)) {
    return LEDGER_AMOUNT_REQUIRED_REPLY
  }

  if (/\?$/.test(normalizedText)) {
    return GENERIC_UNKNOWN_REPLY
  }

  return LEDGER_AMOUNT_REQUIRED_REPLY
}

function normalizeIntentText(value = '') {
  return String(value || '')
    .replace(/\b(tranfer|trasfer|transfr|trnasfer)\b/gi, 'transfer')
    .replace(/\b(trf|tf)\b/gi, 'transfer')
    .replace(/\b(dri|dr)\b/gi, 'dari')
    .replace(/\b(kpd|kepada|tu)\b/gi, 'ke')
    .replace(/\b(pake|pk|pke)\b/gi, 'pakai')
    .replace(/\b(nabng|nabungin)\b/gi, 'nabung')
    .replace(/\b(byr|bayr)\b/gi, 'bayar')
    .replace(/\b(blnja|blanja)\b/gi, 'belanja')
    .replace(/\b(msk)\b/gi, 'masuk')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildTransferGuide({ intro, walletOptions = [] }) {
  const walletHint = walletOptions.length > 0
    ? `Dompet aktif: ${formatCandidateNames(walletOptions.slice(0, 5))}.`
    : 'Buat dompet dulu kalau belum ada.'

  return [
    intro,
    'Format aman: "transfer 100rb dari BCA ke DANA".',
    walletHint,
  ].join('\n')
}

function shouldEscalateTransactionCategory(regexResult, text, learningContext = {}) {
  if (regexResult?.type !== 'transaction') {
    return false
  }

  if (regexResult.transactionType !== 'expense') {
    return false
  }

  if (normalizeCategoryLookup(regexResult.category) !== 'lainnya') {
    return false
  }

  if (hasLearnedCategoryRule(text, learningContext?.categoryRules || [])) {
    return false
  }

  return String(text || '').trim().length >= 6
}

function hasLearnedCategoryRule(text, categoryRules = []) {
  const normalizedText = normalizeCategoryLookup(text)
  if (!normalizedText) {
    return false
  }

  return categoryRules.some((rule) => {
    const normalizedKeyword = normalizeCategoryLookup(rule?.keyword)
    if (!normalizedKeyword) {
      return false
    }

    return ` ${normalizedText} `.includes(` ${normalizedKeyword} `)
  })
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
