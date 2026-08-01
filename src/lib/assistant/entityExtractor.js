import { normalizeIndonesianFinanceText } from '../indonesianFinanceLanguage'
import { resolveCategoryEntities } from './categoryResolver'
import { resolveDateEntities } from './dateResolver'
import {
  extractForeignCurrencyEntities,
  extractMoneyEntities,
} from './moneyExtractor'
import { resolveGoalEntities } from './goalResolver'
import {
  resolveTransferWallets,
  resolveWalletEntities,
  resolveWalletMentions,
} from './walletResolver'
import { extractWalletCreationDetails } from './walletCreationParser'
import { extractIndonesianCandidates } from './indonesianCandidateExtractors'
import {
  resolveCategoryForMessage,
  resolveWalletForMessage,
} from '../chatLearning'

const CONFIRMATION_PATTERN =
  /^(?:ya|iya|yup|betul|benar|oke|ok|sip|setuju|konfirmasi|lanjut|gas)(?:\s+(?:boleh|catat|konfirmasi|setujui|lanjut(?:kan)?|saja|aja|sekarang))?$/iu
const CANCELLATION_PATTERN = /\b(?:batal|batalkan|jangan jadi|tidak jadi|urungkan|cancel|lupakan)\b/iu
const HYPOTHETICAL_PATTERN =
  /\b(?:kalau|andaikan|misal(?:nya)?|seandainya|rencana|berencana|akan|besok|lusa|nanti|hampir|nyaris)\b|\b(?:mau|ingin|pengen|pingin)\b(?!\s+(?:tolong\s+)?(?:catat|simpan|rekam|input|masukkan|tambahkan|buat(?:kan)?|bikin(?:kan)?|transfer|ubah|ganti)\b)/iu
const QUESTION_PATTERN =
  /[?？]\s*$|\b(?:berapa|apakah|gimana|bagaimana|menurutmu|boleh(?:kah)?|bisa(?:kah)?|dapatkah|aman|cukup|kenapa|mengapa)\b/iu
const THIRD_PARTY_PATTERN = /\b(?:teman|temen|istri|suami|adik|kakak|ibu|ayah|mama|papa|pacar|anak|saudara|rekan|dia|mereka|bos)(?:ku|nya)?\b/iu
const CLEAR_INCOMING_THIRD_PARTY_PATTERN =
  /\b(?:teman|temen|istri|suami|adik|kakak|ibu|ayah|mama|papa|pacar|anak|saudara|rekan|dia|mereka|bos)(?:ku|nya)?\b.{0,45}\b(?:transfer|kirim(?:kan)?|kasih|beri)\b.{0,35}\b(?:ke|kepada|buat)\s+(?:saya|aku|gue|gw)\b/iu
const NEGATION_PATTERN = /\b(?:tidak|bukan|belum|jangan|tanpa|gagal)\b/iu
const INCOME_PATTERN = /\b(?:gaji|bonus|pendapatan|pemasukan|terima|menerima|dapat|masuk|cashback|refund|komisi)\b/iu
const EXPENSE_PATTERN = /\b(?:beli|bayar|belanja|jajan|makan|minum|pengeluaran|habis|keluar)\b/iu
const QUANTITY_PATTERN = /\b(\d+(?:[.,]\d+)?)\s*(meter|cm|mm|km|botol|buah|orang|kali|lembar|pcs|unit|kg|gram|liter|ml)\b/giu
const MERCHANT_PATTERN = /\b(?:di|ke)\s+([\p{L}\p{N}][\p{L}\p{N}\s.&'-]{1,40}?)(?=\s+(?:pakai|pake|dari|sebesar|senilai|rp|\d)|[,.;!?]|$)/giu

export function extractAssistantEntities({
  text = '',
  wallets = [],
  archivedWallets = [],
  categories = [],
  goals = [],
  memory = [],
  categoryRules = [],
  walletRules = [],
  now = new Date(),
} = {}) {
  const normalizedText = normalizeIndonesianFinanceText(text)
  const transactionType = inferTransactionType(normalizedText)
  const amounts = extractMoneyEntities(normalizedText)
  const foreignCurrencies = extractForeignCurrencyEntities(normalizedText)
  const explicitWalletEntities = resolveWalletEntities({
    text: normalizedText,
    wallets,
    memory,
  })
  const learnedWallet = resolveWalletForMessage({
    text: normalizedText,
    wallets,
    walletRules,
  })
  const walletEntities = explicitWalletEntities.length > 0
    ? explicitWalletEntities
    : learnedWallet.resolution === 'learned' && learnedWallet.wallet
      ? [{
          id: learnedWallet.wallet.id,
          name: learnedWallet.wallet.name,
          wallet: learnedWallet.wallet,
          confidence: 0.9,
          source: 'learned_rule',
          matchedKeyword: learnedWallet.keyword,
          candidates: [],
        }]
      : []
  const transferWallets = resolveTransferWallets({
    text: normalizedText,
    wallets,
  })
  const walletCreation = extractWalletCreationDetails(normalizedText)
  const archivedWalletEntities = resolveWalletEntities({
    text: normalizedText,
    wallets: archivedWallets.map((wallet) => ({
      ...wallet,
      is_archived: false,
    })),
  })

  const specialistCandidates = extractIndonesianCandidates({
    text: normalizedText,
    amounts,
    wallets: walletEntities,
    goals,
  })

  const inferredCategories = resolveCategoryEntities({
    text: normalizedText,
    categories,
    transactionType,
  })
  const learnedCategory = resolveCategoryForMessage({
    text: normalizedText,
    categories,
    categoryRules,
    transactionType,
  })
  const categoryEntities = learnedCategory.resolution === 'learned' && learnedCategory.category
    ? [{
        id: learnedCategory.category.id,
        name: learnedCategory.category.name,
        category: learnedCategory.category,
        transactionType,
        confidence: 0.9,
        source: 'learned_rule',
        matchedKeyword: learnedCategory.keyword,
        ambiguous: false,
        candidates: [],
      }]
    : inferredCategories

  return {
    normalizedText,
    amounts,
    foreignCurrencies,
    wallets: walletEntities,
    walletMentions: resolveWalletMentions({
      text: normalizedText,
      wallets,
    }),
    transferWallets,
    walletCreation,
    archivedWallets: archivedWalletEntities,
    categories: categoryEntities,
    goals: resolveGoalEntities({
      text: normalizedText,
      goals,
    }),
    merchants: extractMerchants(normalizedText),
    dates: resolveDateEntities(normalizedText, now),
    transactionTypes: transactionType
      ? [{ value: transactionType, confidence: 0.92 }]
      : [],
    quantities: Array.from(normalizedText.matchAll(QUANTITY_PATTERN), (match) => ({
      raw: match[0],
      value: Number(String(match[1]).replace(',', '.')),
      unit: match[2].toLowerCase(),
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    })),
    confirmation: CONFIRMATION_PATTERN.test(normalizedText) ? true : null,
    cancellation: CANCELLATION_PATTERN.test(normalizedText),
    hypothetical: HYPOTHETICAL_PATTERN.test(normalizedText),
    question: QUESTION_PATTERN.test(normalizedText),
    thirdParty:
      THIRD_PARTY_PATTERN.test(normalizedText) &&
      !CLEAR_INCOMING_THIRD_PARTY_PATTERN.test(normalizedText),
    negated: NEGATION_PATTERN.test(normalizedText),
    specialistCandidates,
  }
}

function inferTransactionType(text) {
  const income = INCOME_PATTERN.test(text)
  const expense = EXPENSE_PATTERN.test(text)
  if (income && !expense) return 'income'
  if (expense && !income) return 'expense'
  return null
}

function extractMerchants(text) {
  return Array.from(text.matchAll(MERCHANT_PATTERN), (match) => ({
    raw: match[0],
    name: match[1].trim(),
    confidence: 0.72,
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }))
}
