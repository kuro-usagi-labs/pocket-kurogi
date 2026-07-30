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
import { applyLearnedWalletRuleToAnalysis } from './chatLearning'
import { getChatWriteCandidate, isChatWriteIntentType } from './chatWriteSafety'
import { analyzeConversationalFinance, extractMoneyMentions } from './conversationalFinance'
import {
  assessIndonesianFinanceUtterance,
  normalizeIndonesianFinanceText,
} from './indonesianFinanceLanguage'
import { detectSmartFinanceQuery } from './smartFinance'
import { extractWalletCreationDetails } from './assistant/walletCreationParser'
import { selectFreshResponse } from './assistant/responseVariety'

const LEDGER_AMOUNT_REQUIRED_REPLY =
  'Ceritakan jenis transaksi, nominal, dan dompetnya. Contoh: “beli kopi 50rb dari BCA” atau “gaji 5jt masuk BCA”.'
const GENERIC_UNKNOWN_REPLIES = [
  'Aku belum menangkap tujuanmu dengan pasti. Kamu bisa minta analisis keuangan atau cerita soal transaksi, saldo, dompet, budget, dan target tabungan.',
  'Maksudmu belum cukup jelas buatku. Coba minta analisis keuangan atau ceritakan apa yang ingin dicek maupun dicatat.',
  'Aku ingin memastikan dulu supaya tidak salah memahami. Kamu sedang ingin mencatat sesuatu atau meminta analisis keuangan?',
]
const HELP_REPLIES = [
  [
    'Aku bisa bantu catat transaksi, membuat dan mengelola dompet, transfer antar-dompet, mengecek saldo, membaca arus kas, menyusun budget, dan memantau target tabungan.',
    'Ceritakan saja secara natural, misalnya: "buatkan dompet BCA", "beli kopi 25rb dari BCA", atau "budget harianku aman berapa?"',
    'Aku juga bisa belajar istilahmu, misalnya: "ajari Kurogi bahwa ngopi berarti kategori Kopi".',
  ].join('\n'),
  [
    'Kamu bisa menganggapku asisten keuangan pribadimu: catat transaksi, cek saldo, membuat dan mengelola dompet, susun budget, atau bahas target menabung.',
    'Tidak perlu format kaku. Contohnya: "tadi makan 30rb pakai BCA, catat ya".',
    'Untuk mengajariku kebiasaanmu, coba: "kalau aku bilang kantor, pakai dompet BCA".',
  ].join('\n'),
  [
    'Aku bisa bantu catat transaksi sampai membuat dan mengelola dompet serta meringkas kondisi keuanganmu. Transfer, budget, dan target tabungan juga bisa dikelola lewat chat.',
    'Mulai saja dari hal yang baru terjadi atau tanyakan apa yang paling ingin kamu ketahui.',
    'Kamu juga dapat mengajariku kategori atau dompet untuk istilah tertentu, lalu menyuruhku melupakannya kapan saja.',
  ].join('\n'),
]
const GREETING_REPLIES = [
  'Halo! Ada transaksi yang mau dicatat, atau kamu ingin mengecek kondisi keuangan hari ini?',
  'Hai! Aku siap membantu. Kamu mau mulai dari transaksi terbaru, saldo, atau rencana pengeluaran?',
  'Halo, aku di sini. Ceritakan saja soal uangmu dengan bahasa sehari-hari, nanti kita rapikan bersama.',
  'Hai! Mau mencatat sesuatu atau ngobrol dulu soal kondisi keuanganmu?',
]
const GRATITUDE_REPLIES = [
  'Sama-sama. Kalau ada transaksi lain, tinggal ceritakan seperti biasa.',
  'Dengan senang hati. Aku siap bantu kapan pun kamu ingin mencatat atau mengecek keuangan.',
  'Sama-sama! Kita lanjut kapan saja kamu butuh.',
]
const ACKNOWLEDGMENT_REPLIES = [
  'Siap. Kalau ada hal lain yang ingin dicatat atau dicek, langsung bilang saja.',
  'Oke. Aku tetap di sini kalau kamu ingin lanjut.',
  'Sip, kita lanjut kapan pun kamu siap.',
]
const IDENTITY_REPLIES = [
  'Aku Kurogi, asisten keuangan pribadimu di aplikasi ini. Tugasku membantu memahami ceritamu, merapikan transaksi, dan memberi gambaran keuangan tanpa mengubah data kalau maksudmu belum jelas.',
  'Aku Kurogi. Anggap saja aku teman pencatatan keuanganmu: bisa diajak ngobrol natural, tetapi tetap berhati-hati sebelum menjalankan aksi.',
]
const GETTING_STARTED_REPLIES = [
  'Tidak perlu mulai dari semuanya sekaligus. Ceritakan satu hal dulu: saldo yang kamu punya sekarang atau transaksi terakhir yang kamu ingat.',
  'Kita mulai dari yang paling mudah. Kamu bisa sebutkan dompet utama dan saldonya, atau ceritakan pengeluaran terakhirmu.',
  'Aku bantu pelan-pelan. Mulai saja dengan kalimat seperti "saldo BCA saya 500rb" atau "tadi beli makan 20rb".',
]
const TRANSFER_INTENT_PATTERN = /\b(transfer|trf|tf|trasfer|tranfer|pindah|pindahin|geser|kirim|kirimkan|oper|mutasi|move)\b/i
const ASSISTANT_HELP_PATTERN =
  /\b(?:bisa\s+(?:apa|ngapain|melakukan apa)|bantu\s+apa|apa(?:\s+dong)?\s+yang\s+(?:kamu|kau|anda)?\s*bisa|kamu\s+bisa\s+apa|kemampuan|fitur|cara\s+(?:pakai|gunakan)|contoh\s+perintah|command|help|panduan|instruksi)\b/iu
const GENERIC_WALLET_REFERENCE_PATTERN = /^(uang|saldo|cash|tunai|dompet|rekening|wallet|uang tunai)$/i

/** Analyze text locally with deterministic rules and learned user preferences. */
export async function analyzeTransaction(
  text,
  imageBase64 = null,
  walletOptions = [],
  goalOptions = [],
  categoryOptions = [],
  financialContext = '',
  learningContext = {}
) {
  void financialContext
  const archivedWalletOptions = learningContext?.archivedWalletOptions || []
  const normalizedPreview = normalizeIntentText(normalizeNumericText(String(text || '').toLowerCase().trim()))
  const knownSmartFinanceQuery = detectSmartFinanceQuery(normalizedPreview, walletOptions, goalOptions)

  if (knownSmartFinanceQuery) {
    return knownSmartFinanceQuery
  }

  if (!learningContext?.financeDraft) {
    const earlyCorrection = detectLastTransactionCorrection(
      normalizedPreview,
      walletOptions,
      categoryOptions
    )
    const hasConcreteCorrection =
      Boolean(earlyCorrection?.amount) ||
      /\b(?:koreksi|revisi|ubah|ganti)\b/iu.test(normalizedPreview)

    if (earlyCorrection && hasConcreteCorrection) {
      return finalizeChatFinanceAnalysis({
        text: text || '',
        result: earlyCorrection,
        walletOptions,
        context: null,
      })
    }
  }

  const conversationalResult = analyzeConversationalFinance({
    text: text || '',
    walletOptions,
    context: learningContext?.financeDraft || null,
    financialState: learningContext?.financialState || {},
    now: learningContext?.now || new Date(),
  })

  if (conversationalResult) {
    const finalizedConversationalResult = finalizeChatFinanceAnalysis({
      text: text || '',
      result: conversationalResult,
      walletOptions,
      context: learningContext?.financeDraft || null,
    })
    return applyLearnedWalletRuleToAnalysis({
      analysis: finalizedConversationalResult,
      text: text || '',
      wallets: walletOptions,
      walletRules: learningContext?.walletRules || [],
    })
  }

  const localResult = analyzeWithRegex(
    text || '',
    walletOptions,
    goalOptions,
    archivedWalletOptions,
    categoryOptions,
    {
      recentAssistantMessages: learningContext?.recentAssistantReplies || [],
    }
  )

  if (imageBase64 && !String(text || '').trim()) {
    return {
      type: 'unknown',
      reply: 'Gambar sudah tersimpan. Agar tetap privat tanpa layanan AI, tuliskan nominal dan keterangannya, misalnya “makan 45rb dari BCA”.',
    }
  }

  const finalizedResult = finalizeChatFinanceAnalysis({
    text: text || '',
    result: localResult,
    walletOptions,
    context: learningContext?.financeDraft || null,
  })
  return applyLearnedWalletRuleToAnalysis({
    analysis: finalizedResult,
    text: text || '',
    wallets: walletOptions,
    walletRules: learningContext?.walletRules || [],
  })
}

export function assessPendingFinanceReply(text, { allowImplicitUnit = false } = {}) {
  const normalizedText = normalizeIndonesianFinanceText(text)
  const mentions = extractMoneyMentions(normalizedText)
  const assessment = assessIndonesianFinanceUtterance({
    text: normalizedText,
    hasContext: true,
    mentions,
  })
  const ignoredCodes = new Set(['NO_EXPLICIT_WRITE_REQUEST'])
  if (allowImplicitUnit) ignoredCodes.add('IMPLICIT_CURRENCY_UNIT')
  const blockingAmbiguities = assessment.ambiguities.filter(
    (ambiguity) => !ignoredCodes.has(ambiguity.code)
  )

  return {
    safe: blockingAmbiguities.length === 0,
    normalizedText,
    mentions,
    ambiguities: blockingAmbiguities,
    reply: blockingAmbiguities[0]?.message || '',
  }
}

function finalizeChatFinanceAnalysis({ text, result, walletOptions = [], context = null }) {
  if (!result || typeof result !== 'object') return result

  const normalizedText = normalizeIndonesianFinanceText(text)
  const mentions = extractMoneyMentions(normalizedText)
  const assessment = assessIndonesianFinanceUtterance({
    text: normalizedText,
    hasContext: Boolean(context),
    mentions,
  })

  if (result.type === 'transaction_batch') {
    const isReviewedShortConfirmation =
      Boolean(result.derivedFromDraft && result.understanding?.confirmedByUser) &&
      /^(?:ya|iya|yup|betul|benar|oke|ok|sip)$/iu.test(normalizedText)

    if (
      result.writeDecision !== 'commit' ||
      assessment.blocksWrite && !isReviewedShortConfirmation
    ) {
      const detail = assessment.ambiguities[0]?.message ||
        'Hasil parser belum memiliki bukti struktur yang cukup untuk menulis ledger.'
      return {
        type: 'unknown',
        reply: `Saya belum mencatat apa pun. ${detail}`,
      }
    }

    return result
  }

  const transactionCandidate = result.type === 'transaction'
    ? result
    : result.type === 'needs_confirmation' && result.intent?.type === 'transaction'
      ? result.intent
      : null

  if (!transactionCandidate) {
    const mutationCandidate = getChatWriteCandidate(result)
    if (!isChatWriteIntentType(mutationCandidate?.type)) return result

    if (assessment.blocksWrite) {
      const detail = assessment.ambiguities[0]?.message ||
        'Struktur pesan belum membuktikan adanya instruksi aksi yang final.'
      return {
        type: 'unknown',
        reply: `Saya belum menjalankan aksi apa pun. ${detail}`,
      }
    }

    const safeMutationCandidate = {
      ...mutationCandidate,
      writeDecision: 'commit',
      understanding: {
        writeDecision: 'commit',
        ambiguities: [],
        evidence: assessment.evidence,
      },
    }

    if (result.type === 'needs_confirmation') {
      return {
        ...result,
        intent: safeMutationCandidate,
      }
    }

    return safeMutationCandidate
  }

  const ambiguityCodes = new Set(assessment.ambiguities.map((ambiguity) => ambiguity.code))
  const onlyMissingWriteRequest = ambiguityCodes.size === 1 &&
    ambiguityCodes.has('NO_EXPLICIT_WRITE_REQUEST')
  const candidateAmount = Number(transactionCandidate.amount || 0)
  if (
    candidateAmount > 0 &&
    (
      mentions.length !== 1 ||
      Number(mentions[0]?.value || 0) !== candidateAmount
    )
  ) {
    return {
      type: 'unknown',
      reply: 'Saya belum mencatat apa pun. Ada lebih dari satu nominal atau nominal hasil parser tidak sama dengan bukti teks. Tulis ulang satu transaksi dengan satu nominal final.',
    }
  }

  const category = String(transactionCandidate.category || '').toLowerCase()
  const vagueItem = category === 'lainnya' &&
    !/\b(?:beli|bayar|belanja|jajan|makan|minum|gaji|bonus|terima|dapat|pengeluaran|pemasukan)\b/iu.test(normalizedText)

  if (vagueItem) {
    return {
      type: 'unknown',
      reply: 'Saya belum mencatat apa pun. Nominalnya terbaca, tetapi belum jelas ini pemasukan atau pengeluaran untuk item apa. Tulis contoh seperti "catat pengeluaran servis Rp50.000 dari Tunai".',
    }
  }

  if (assessment.blocksWrite && !onlyMissingWriteRequest) {
    const detail = assessment.ambiguities[0]?.message ||
      'Struktur pesan masih ambigu dan perlu ditulis ulang.'
    return {
      type: 'unknown',
      reply: `Saya belum mencatat apa pun. ${detail}`,
    }
  }

  if (!assessment.evidence.explicitWriteRequested || onlyMissingWriteRequest) {
    const wallet = walletOptions.find((option) => option.id === transactionCandidate.walletId) || null
    const direction = transactionCandidate.transactionType === 'income' ? 'Pemasukan' : 'Pengeluaran'
    const description = transactionCandidate.desc || transactionCandidate.category || 'Transaksi'
    const walletPhrase = wallet
      ? `${transactionCandidate.transactionType === 'income' ? ' ke' : ' dari'} ${wallet.name}`
      : ''
    return {
      type: 'finance_calculation',
      draft: {
        version: 2,
        status: wallet ? 'proposed' : 'needs_wallet',
        items: [{
          clientItemId: 'item-1',
          transactionType: transactionCandidate.transactionType || 'expense',
          amount: transactionCandidate.amount,
          desc: transactionCandidate.desc,
          category: transactionCandidate.category,
          walletId: wallet?.id || null,
          wallet: wallet?.name || null,
          rawText: normalizedText,
        }],
        walletId: wallet?.id || null,
        wallet: wallet?.name || null,
        missingSlots: wallet ? [] : ['wallet'],
        understanding: {
          writeDecision: 'review',
          ambiguities: ['Belum ada instruksi pencatatan eksplisit.'],
          evidence: assessment.evidence,
        },
      },
      reply: `${direction} ${formatRupiahLocal(transactionCandidate.amount)}${walletPhrase} untuk ${description}. Saya belum mencatatnya. Jika sudah benar, pilih Ya atau bilang "catat transaksi tadi".`,
    }
  }

  const safeCandidate = {
    ...transactionCandidate,
    writeDecision: 'commit',
    understanding: {
      writeDecision: 'commit',
      ambiguities: [],
      evidence: assessment.evidence,
    },
  }

  if (result.type === 'needs_confirmation') {
    return {
      ...result,
      intent: safeCandidate,
    }
  }

  return safeCandidate
}

function formatRupiahLocal(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

export function analyzeWithRegex(
  text,
  walletOptions,
  goalOptions = [],
  archivedWalletOptions = [],
  categoryOptions = [],
  responseContext = {}
) {
  let normalizedText = normalizeIntentText(
    normalizeNumericText(normalizeIndonesianFinanceText(text))
  )
  const recentAssistantMessages = responseContext?.recentAssistantMessages || []
  const teachingIntent = detectExplicitTeachingIntent({
    text,
    normalizedText,
    walletOptions,
    categoryOptions,
  })
  const helpQuery = detectAssistantHelpQuery(normalizedText, recentAssistantMessages)
  const smallTalk = detectNaturalSmallTalk(normalizedText, recentAssistantMessages)
  const analyticsQuery = detectAnalyticsQuery(normalizedText)
  const adviceQuery = detectAdviceQuery(normalizedText)
  const smartFinanceQuery = detectSmartFinanceQuery(normalizedText, walletOptions, goalOptions)

  if (teachingIntent) {
    return teachingIntent
  }

  if (helpQuery) {
    return helpQuery
  }

  if (smallTalk) {
    return smallTalk
  }

  if (smartFinanceQuery) {
    return smartFinanceQuery
  }

  if (adviceQuery) {
    return adviceQuery
  }

  const undoIntent = detectUndoIntent(normalizedText)
  if (undoIntent) {
    return undoIntent
  }

  const correctionIntent = detectLastTransactionCorrection(normalizedText, walletOptions, categoryOptions)
  if (correctionIntent) {
    return correctionIntent
  }

  const goalWithdrawal = detectGoalWithdrawalIntent(normalizedText, walletOptions, goalOptions)
  if (goalWithdrawal) {
    return goalWithdrawal
  }

  const goalContribution = detectGoalContributionIntent(normalizedText, walletOptions, goalOptions)
  if (goalContribution) {
    return goalContribution
  }

  const incomingTransfer = detectIncomingTransferIntent(normalizedText, walletOptions)
  if (incomingTransfer) {
    return incomingTransfer
  }

  const walletTransfer = detectWalletTransferIntent(normalizedText, walletOptions)
  if (walletTransfer) {
    return walletTransfer
  }

  const walletCreation = detectWalletCreationIntent(text, normalizedText)
  if (walletCreation) {
    return walletCreation
  }

  const goalCreation = detectGoalCreationIntent(normalizedText, walletOptions)
  if (goalCreation) {
    return goalCreation
  }

  if (!analyticsQuery && /(tabungan|milestone|target)/i.test(normalizedText)) {
    return { type: 'unknown' }
  }

  if (/^(halo|hai|hi|hey|pagi|siang|sore|malam)/.test(normalizedText) && !/\d/.test(normalizedText)) {
    return {
      type: 'greeting',
      reply: selectFreshResponse(GREETING_REPLIES, {
        recentMessages: recentAssistantMessages,
        seed: normalizedText,
      }),
    }
  }

  if (/^(ya|iya|iy|yes|ok(?:e+)?|sip|siap|baik|mantap|betul|benar)$/i.test(normalizedText)) {
    return {
      type: 'unknown',
      reply: selectFreshResponse(ACKNOWLEDGMENT_REPLIES, {
        recentMessages: recentAssistantMessages,
        seed: normalizedText,
      }),
    }
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

  const amountMatch = matchMoney(normalizedText)

  if (!amountMatch) {
    return {
      type: 'unknown',
      reply: buildUnknownReply(normalizedText, recentAssistantMessages),
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
  desc = desc
    .replace(/^(?:tolong|mohon|bantu)\s+/i, '')
    .replace(/^(?:(?:di|men)?catat|simpan|rekam|masukkan|input|tambah(?:kan)?)\s+/i, '')
    .replace(/^(?:pengeluaran|pemasukan|expense|income)\b\s*/i, '')
    .replace(/^(?:untuk|buat)\b\s*/i, '')
  desc = desc.replace(/^(beli|bayar|buat|dari|terima|dapat|pake|pakai|-|\+)\s+/gi, '').trim()
  desc = desc.replace(/\b(?:dari|ke|pakai|pake|via)\s*$/i, '').trim()
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

function detectAssistantHelpQuery(normalizedText, recentAssistantMessages = []) {
  if (!normalizedText || !ASSISTANT_HELP_PATTERN.test(normalizedText)) {
    return null
  }

  return {
    type: 'unknown',
    reply: selectFreshResponse(HELP_REPLIES, {
      recentMessages: recentAssistantMessages,
      seed: normalizedText,
    }),
  }
}

export function detectExplicitTeachingIntent({
  text = '',
  normalizedText = '',
  walletOptions = [],
  categoryOptions = [],
} = {}) {
  const forgetMatch = String(text).trim().match(
    /^(?:lupakan(?:\s+(?:aturan|pelajaran|ingatan))?|hapus\s+(?:aturan|pelajaran|ingatan))(?:\s+(kategori|dompet|wallet))?(?:\s+(?:untuk|tentang|kata|istilah))?\s+["“]?(.+?)["”]?[.!]?$/iu
  )
  if (forgetMatch?.[2]) {
    const keyword = cleanLearningKeyword(forgetMatch[2])
    if (!keyword) return invalidLearningKeywordReply()
    return {
      type: 'forget_learning_rule',
      keyword,
      ruleType: /dompet|wallet/iu.test(forgetMatch[1] || '')
        ? 'wallet'
        : /kategori/iu.test(forgetMatch[1] || '')
          ? 'category'
          : 'all',
    }
  }

  const categoryMatch = matchTeachingPair(text, [
    /^(?:tolong\s+)?(?:ajari|ajarkan|ingat|ingatlah)(?:\s+(?:kamu|bot|kurogi))?(?:\s+bahwa)?\s+["“]?(.+?)["”]?\s+(?:itu\s+)?(?:artinya|berarti|masuk|sebagai)\s+kategori\s+["“]?(.+?)["”]?[.!]?$/iu,
    /^(?:mulai sekarang\s+)?kalau\s+(?:aku|saya)\s+bilang\s+["“]?(.+?)["”]?\s*,?\s+(?:anggap|masukkan|masukin|kategorikan)(?:\s+itu)?(?:\s+sebagai|\s+ke|\s+masuk)?\s+kategori\s+["“]?(.+?)["”]?[.!]?$/iu,
    /^(?:mulai sekarang\s+)?kalau\s+(?:aku|saya)\s+bilang\s+["“]?(.+?)["”]?\s*,?\s+(?:itu\s+)?(?:berarti|artinya|masuk)?\s*kategori(?:nya)?\s+["“]?(.+?)["”]?[.!]?$/iu,
  ])
  if (categoryMatch) {
    return buildTeachingResult({
      type: 'teach_category_rule',
      keyword: categoryMatch.keyword,
      targetName: categoryMatch.targetName,
      options: categoryOptions,
      targetLabel: 'kategori',
      idKey: 'categoryId',
    })
  }

  const walletMatch = matchTeachingPair(text, [
    /^(?:tolong\s+)?(?:ajari|ajarkan|ingat|ingatlah)(?:\s+(?:kamu|bot|kurogi))?(?:\s+bahwa)?\s+["“]?(.+?)["”]?\s+(?:itu\s+)?(?:artinya|berarti|gunakan|pakai)\s+(?:dompet|wallet|rekening)\s+["“]?(.+?)["”]?[.!]?$/iu,
    /^(?:mulai sekarang\s+)?kalau\s+(?:aku|saya)\s+bilang\s+["“]?(.+?)["”]?\s*,?\s+(?:pakai|gunakan)(?:\s+itu)?\s+(?:dompet|wallet|rekening)\s+["“]?(.+?)["”]?[.!]?$/iu,
    /^(?:mulai sekarang\s+)?kalau\s+(?:aku|saya)\s+bilang\s+["“]?(.+?)["”]?\s*,?\s+(?:maksudnya|artinya|berarti)\s+(?:pakai\s+)?(?:dompet|wallet|rekening)\s+["“]?(.+?)["”]?[.!]?$/iu,
  ])
  if (walletMatch) {
    return buildTeachingResult({
      type: 'teach_wallet_rule',
      keyword: walletMatch.keyword,
      targetName: walletMatch.targetName,
      options: walletOptions,
      targetLabel: 'dompet',
      idKey: 'walletId',
    })
  }

  if (
    /\b(?:jawab|balas|respons|jelaskan)\b.{0,24}\b(?:singkat|ringkas|to the point)\b/iu.test(
      normalizedText
    )
  ) {
    return {
      type: 'unknown',
      reply: 'Siap, aku akan menjawab lebih ringkas mulai sekarang.',
    }
  }
  if (
    /\b(?:jawab|balas|respons|jelaskan)\b.{0,24}\b(?:lebih detail|lengkap|terperinci)\b/iu.test(
      normalizedText
    )
  ) {
    return {
      type: 'unknown',
      reply: 'Baik, aku akan memberi penjelasan yang lebih lengkap mulai sekarang.',
    }
  }

  return null
}

function matchTeachingPair(text, patterns) {
  for (const pattern of patterns) {
    const match = String(text || '').trim().match(pattern)
    if (!match?.[1] || !match?.[2]) continue
    const keyword = cleanLearningKeyword(match[1])
    const targetName = cleanLearningTarget(match[2])
    if (!keyword || !targetName) return { keyword: null, targetName: null }
    return { keyword, targetName }
  }
  return null
}

function buildTeachingResult({
  type,
  keyword,
  targetName,
  options,
  targetLabel,
  idKey,
}) {
  if (!keyword || !targetName) return invalidLearningKeywordReply()
  const resolution = resolveOptionReference({
    input: targetName,
    options,
  })

  if (resolution.match) {
    return {
      type,
      keyword,
      [idKey]: resolution.match.id,
      targetName: resolution.match.name,
    }
  }

  if (resolution.candidates.length > 0) {
    return {
      type: 'unknown',
      reply: `Nama ${targetLabel}nya masih ambigu. Maksudmu ${formatCandidateNames(resolution.candidates)}?`,
    }
  }

  return {
    type: 'unknown',
    reply: `Aku belum menemukan ${targetLabel} "${targetName}". Buat atau pilih ${targetLabel} yang sudah ada dulu agar aku tidak mempelajari aturan yang salah.`,
  }
}

function cleanLearningKeyword(value = '') {
  const keyword = normalizeEntityName(value)
    .replace(/^(?:kata|istilah)\s+/iu, '')
    .trim()
  const blocked = /^(?:uang|saldo|transaksi|pengeluaran|pemasukan|dompet|wallet|rekening|kategori|catat|beli|bayar|masuk|keluar)$/iu
  if (
    keyword.length < 2 ||
    keyword.length > 48 ||
    keyword.split(/\s+/u).length > 6 ||
    /\d/u.test(keyword) ||
    blocked.test(keyword)
  ) {
    return null
  }
  return keyword
}

function cleanLearningTarget(value = '') {
  return String(value || '')
    .replace(/[.!?,]+$/u, '')
    .replace(/^["“”']+|["“”']+$/gu, '')
    .trim()
}

function invalidLearningKeywordReply() {
  return {
    type: 'unknown',
    reply: 'Aku belum menyimpan aturan itu. Gunakan istilah khusus sepanjang 2–48 karakter tanpa nominal, misalnya "ngopi" atau "makan kantor".',
  }
}

function detectNaturalSmallTalk(normalizedText, recentAssistantMessages = []) {
  const responseOptions = {
    recentMessages: recentAssistantMessages,
    seed: normalizedText,
  }

  if (/^(?:makasih|terima kasih|thanks|thank you)(?:\s+(?:ya|yah|banget|banyak))?[.!]*$/iu.test(normalizedText)) {
    return {
      type: 'unknown',
      reply: selectFreshResponse(GRATITUDE_REPLIES, responseOptions),
    }
  }

  if (/\b(?:kamu siapa|siapa kamu|siapa namamu|nama kamu siapa|kenalan dong)\b/iu.test(normalizedText)) {
    return {
      type: 'unknown',
      reply: selectFreshResponse(IDENTITY_REPLIES, responseOptions),
    }
  }

  if (
    /\b(?:bingung|tidak tahu|ga tahu|gak tahu|nggak tahu)\b.{0,24}\b(?:mulai|harus apa|ngapain)\b/iu.test(
      normalizedText
    ) ||
    /\b(?:mulai dari mana|harus mulai dari apa)\b/iu.test(normalizedText)
  ) {
    return {
      type: 'unknown',
      reply: selectFreshResponse(GETTING_STARTED_REPLIES, responseOptions),
    }
  }

  return null
}

function detectUndoIntent(normalizedText) {
  if (!/(undo|batalkan|batalin|hapus|revert|kembalikan)/i.test(normalizedText)) {
    return null
  }

  if (!/(transaksi terakhir|catatan terakhir|input terakhir|yang terakhir|terakhir)/i.test(normalizedText)) {
    return null
  }

  if (/(semua|massal|riwayat)/i.test(normalizedText)) {
    return null
  }

  return {
    type: 'undo_transaction',
    reply: 'Saya akan membatalkan transaksi manual terakhir yang masih bisa dibatalkan.',
  }
}

function detectLastTransactionCorrection(normalizedText, walletOptions = [], categoryOptions = []) {
  if (!normalizedText) {
    return null
  }

  if (!/(yang tadi|yang terakhir|transaksi terakhir|catatan terakhir|input terakhir|barusan|tadi)/i.test(normalizedText)) {
    return null
  }

  if (!/(harusnya|seharusnya|koreksi|revisi|ubah|ganti|jadi|pindah)/i.test(normalizedText)) {
    return null
  }

  const amountMatch = matchMoney(normalizedText)
  const nextAmount = amountMatch ? parseMoneyMatch(amountMatch) : null
  const keywordWalletResolution = findOptionAfterKeyword({
    text: normalizedText,
    options: walletOptions,
    keywords: ['dari', 'ke', 'pakai', 'pake', 'dompet', 'rekening', 'wallet'],
  })
  const broadWalletResolution = resolveOptionReference({
    input: normalizedText,
    options: walletOptions,
  })
  const walletResolution =
    keywordWalletResolution.match || keywordWalletResolution.candidates.length > 0
      ? keywordWalletResolution
      : ['exact', 'phrase', 'longest'].includes(broadWalletResolution.reason)
        ? broadWalletResolution
        : { match: null, candidates: [], reason: 'missing' }

  const broadCategoryResolution = resolveOptionReference({
    input: normalizedText,
    options: categoryOptions,
  })

  const explicitIncome =
    /\b(harusnya|seharusnya|jadi|ubah(?:kan)?|ganti)\s+(?:sebagai\s+)?pemasukan\b/i.test(normalizedText)
  const explicitExpense =
    /\b(harusnya|seharusnya|jadi|ubah(?:kan)?|ganti)\s+(?:sebagai\s+)?pengeluaran\b/i.test(normalizedText)

  let nextCategoryName =
    ['exact', 'phrase', 'longest'].includes(broadCategoryResolution.reason)
      ? broadCategoryResolution.match?.name || null
      : null
  if (!nextCategoryName) {
    const inferredCategory = inferCategoryFromText({
      text: normalizedText,
      transactionType: explicitIncome ? 'income' : 'expense',
    })

    if (inferredCategory?.categoryName && normalizeCategoryLookup(inferredCategory.categoryName) !== 'lainnya') {
      nextCategoryName = inferredCategory.categoryName
    }
  }

  if (walletResolution.candidates.length > 0 && !walletResolution.match) {
    return createNeedsConfirmation({
      reason: 'ambiguous_wallet',
      prompt: `Dompet koreksinya masih ambigu. Pilih salah satu: ${formatCandidateNames(walletResolution.candidates)}.`,
      candidates: walletResolution.candidates,
      intent: {
        type: 'correct_last_transaction',
        amount: nextAmount,
        category: nextCategoryName,
        transactionType: explicitIncome ? 'income' : explicitExpense ? 'expense' : null,
      },
    })
  }

  if (!nextAmount && !walletResolution.match && !nextCategoryName && !explicitIncome && !explicitExpense) {
    return null
  }

  return {
    type: 'correct_last_transaction',
    amount: nextAmount,
    walletId: walletResolution.match?.id || null,
    wallet: walletResolution.match?.name || null,
    category: nextCategoryName,
    transactionType: explicitIncome ? 'income' : explicitExpense ? 'expense' : null,
    reply: 'Siap, saya koreksi transaksi terakhir.',
  }
}

function detectGoalCreationIntent(normalizedText, walletOptions = []) {
  if (!/^(buat|bikin|tambah|create)\s+(target|goal|tabungan|milestone)\b/i.test(normalizedText)) {
    return null
  }

  const amountMatch = matchMoney(normalizedText)
  const targetAmount = amountMatch ? parseMoneyMatch(amountMatch) : 0
  const cleanedName = cleanEntityText(
    normalizedText
      .replace(/^(buat|bikin|tambah|create)\s+(target|goal|tabungan|milestone)\s*/i, '')
      .replace(amountMatch?.[0] || '', '')
      .replace(/\b(target|sebesar|senilai|dengan|nominal|total|awal|setoran|dari|pakai|via)\b.*$/i, '')
  )

  if (!cleanedName) {
    return createNeedsConfirmation({
      reason: 'missing_goal_name',
      prompt: 'Nama target tabungannya apa? Contoh: "buat target Liburan Jepang 5jt".',
      intent: {
        type: 'goal_creation_pending',
        amount: 0,
      },
    })
  }

  if (!targetAmount) {
    return {
      type: 'goal_creation_pending',
      name: toTitleCase(cleanedName),
      amount: 0,
      reply: `Target tabungan **${toTitleCase(cleanedName)}** mau dibuat. Berapa nominal target totalnya? Contoh: 5jt atau 1000000.`,
    }
  }

  const sourceResolution = findOptionAfterKeyword({
    text: normalizedText,
    options: walletOptions,
    keywords: ['dari', 'pakai', 'pake', 'via'],
  })

  return {
    type: 'goal_creation_pending',
    name: toTitleCase(cleanedName),
    amount: 0,
    targetAmount,
    sourceWalletId: sourceResolution.match?.id || null,
    sourceWallet: sourceResolution.match?.name || null,
    reply: `Target tabungan **${toTitleCase(cleanedName)}** mau dibuat dengan target **${targetAmount.toLocaleString('id-ID')}**. Mau pakai setoran awal juga atau mulai dari nol?`,
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

function detectWalletCreationIntent(text, normalizedText) {
  const details = extractWalletCreationDetails(text)
  if (!details.isCreationRequest) return null

  if (!details.walletName) {
    return {
      type: 'needs_confirmation',
      reason: 'missing_wallet_name',
      action: 'create_wallet',
      reply: 'Nama dompet barunya apa? Contoh: "tolong buat dompet bernama BCA".',
      prompt: 'Nama dompet barunya apa? Jawab langsung, misalnya “BCA” atau “GoPay”.',
    }
  }

  const moneyMatch = matchMoney(normalizedText)
  const initialBalance = moneyMatch ? parseMoneyMatch(moneyMatch) : 0

  return {
    type: 'create_wallet',
    name: details.walletName,
    initial_balance: initialBalance,
    wallet_type: details.walletType,
    reply:
      initialBalance > 0
        ? `Siap, dompet ${details.walletName} akan dibuat dengan saldo awal ${initialBalance}.`
        : `Siap, dompet ${details.walletName} akan dibuat tanpa saldo awal.`,
  }
}

function detectIncomingTransferIntent(normalizedText, walletOptions = []) {
  const incomingMatch = normalizedText.match(
    /\b(teman(?:ku|nya)?|temen(?:ku|nya)?|ibu|ayah|mama|papa|istri(?:ku|nya)?|suami(?:ku|nya)?|adik(?:ku|nya)?|kakak(?:ku|nya)?|pacar(?:ku|nya)?|saudara(?:ku|nya)?|anak(?:ku|nya)?|bos|kantor|perusahaan|dia|doi|mereka)\b[^.!?]{0,50}\b(?:transfer|kirim(?:kan)?)\b[^.!?]{0,60}\bke\s+(?:saya|aku|gue)\b/iu
  )
  if (!incomingMatch) return null

  const amountMatch = matchMoney(normalizedText)
  if (!amountMatch) {
    return createNeedsConfirmation({
      reason: 'missing_amount',
      prompt: 'Nominal transfer masuknya berapa? Tulis contoh: "ibu transfer 100rb ke saya, catat ke BCA".',
      intent: {
        type: 'transaction',
        transactionType: 'income',
        desc: `Transfer dari ${toTitleCase(incomingMatch[1])}`,
        category: 'Pemasukan',
      },
    })
  }

  const walletResolution = resolveOptionReference({
    input: normalizedText,
    options: walletOptions,
  })
  const wallet = walletResolution.match || (walletOptions.length === 1 ? walletOptions[0] : null)
  const transaction = {
    type: 'transaction',
    transactionType: 'income',
    amount: parseMoneyMatch(amountMatch),
    desc: `Transfer dari ${toTitleCase(incomingMatch[1])}`,
    category: 'Pemasukan',
    walletId: wallet?.id || null,
    wallet: wallet?.name || null,
  }

  if (wallet) return transaction

  return createNeedsConfirmation({
    reason: walletResolution.candidates.length > 0 ? 'ambiguous_wallet' : 'missing_wallet',
    prompt: walletResolution.candidates.length > 0
      ? `Dompet penerima transfer masih ambigu. Pilih salah satu: ${formatCandidateNames(walletResolution.candidates)}.`
      : `Transfer masuknya diterima di dompet mana? Pilih salah satu: ${formatCandidateNames(walletOptions)}.`,
    candidates: walletResolution.candidates.length > 0
      ? walletResolution.candidates
      : walletOptions,
    intent: transaction,
  })
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

  let rawWalletName =
    extractRawReferenceAfterKeyword(normalizedText, ['dari', 'pakai', 'pake', 'via', 'bank'])

  if (rawWalletName && GENERIC_WALLET_REFERENCE_PATTERN.test(rawWalletName)) {
    const cashWallets = walletOptions.filter((wallet) =>
      wallet.walletType === 'cash' || /^(tunai|cash)$/i.test(wallet.name)
    )

    if (cashWallets.length === 1 && /\b(pakai uang|uang tunai|cash|tunai)\b/i.test(normalizedText)) {
      return {
        match: cashWallets[0],
        candidates: cashWallets,
        reason: 'cash_semantic',
      }
    }

    rawWalletName = null
  }

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

export function normalizeAnalysisResult(analysis, walletOptions, archivedWalletOptions, goalOptions, rawText) {
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

function cleanEntityText(value = '') {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function toTitleCase(value = '') {
  return cleanEntityText(value)
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
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

  if (!/(tips|tip|saran|strategi|rekomendasi|optimalkan|hemat|improve|perbaiki|solusi|evaluasi|review|audit|sehat|aman|atur keuangan|budgeting|rencana|prioritas|bantu saya atur|langkah terbaik|apa yang harus saya lakukan)/i.test(normalizedText)) {
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

  if (/(budget|anggaran|limit|budgeting)/i.test(normalizedText)) {
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

function buildUnknownReply(normalizedText, recentAssistantMessages = []) {
  if (!normalizedText) {
    return selectFreshResponse(GENERIC_UNKNOWN_REPLIES, {
      recentMessages: recentAssistantMessages,
      seed: 'empty',
    })
  }

  if (/\b(?:(?:di|men)?catat|simpan|rekam|input|masukkan|tambahkan)\b/iu.test(normalizedText)) {
    const amountMatch = matchMoney(normalizedText)
    if (amountMatch) {
      return `Saya menangkap nominal ${amountMatch[0].trim()}, tetapi belum tahu transaksi itu untuk apa${/\b(?:dari|pakai|via|dompet|rekening)\b/iu.test(normalizedText) ? '' : ' dan memakai dompet mana'}. Contoh: “catat makan 20rb dari BCA”.`
    }
    return LEDGER_AMOUNT_REQUIRED_REPLY
  }

  if (/(bagaimana|gimana|kenapa|mengapa|apa|tolong|bisakah|bisa|boleh|analisa|analisis|sarankan|strategi|ringkas|ringkasan)/i.test(normalizedText)) {
    return selectFreshResponse(GENERIC_UNKNOWN_REPLIES, {
      recentMessages: recentAssistantMessages,
      seed: normalizedText,
    })
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
    return selectFreshResponse(GENERIC_UNKNOWN_REPLIES, {
      recentMessages: recentAssistantMessages,
      seed: normalizedText,
    })
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

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
