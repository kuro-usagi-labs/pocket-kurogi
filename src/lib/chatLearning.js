import {
  buildAutoCategoryPayload,
  findFallbackCategory,
  inferCategoryFromText,
  normalizeCategoryLookup,
  resolveExistingCategory,
} from './categoryCatalog'

const MONEY_REGEX = /(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta|m)?/i

const INCOME_KEYWORDS = /\b(gaji|bonus|dapat|terima|masuk|topup|cashback|refund|komisi|fee|pendapatan|income|dividen|bunga)\b/i
const COMMAND_WORDS = /\b(beli|bayar|buat|dari|terima|dapat|masuk|untuk|pakai|pake|di|ke|gaji|bonus|tabung|transfer|cairkan|cairin|tarik|ambil)\b/gi

export function normalizeChatText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractAmountFromText(text = '') {
  const normalizedText = String(text)
    .toLowerCase()
    .replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2')
    .replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2')

  const match = normalizedText.match(MONEY_REGEX)
  if (!match) {
    return 0
  }

  let amount = parseFloat(String(match[1]).replace(',', '.'))
  const multiplier = String(match[2] || '').toLowerCase()

  if (['k', 'rb', 'ribu'].includes(multiplier)) amount *= 1000
  else if (['jt', 'juta'].includes(multiplier)) amount *= 1000000
  else if (multiplier === 'm') amount *= 1000000000
  else if (amount > 0 && amount < 1000) amount *= 1000

  return Number.isFinite(amount) ? amount : 0
}

export function detectTransactionTypeFromText(text = '') {
  return INCOME_KEYWORDS.test(text) ? 'income' : 'expense'
}

export function findMentionedEntity(text = '', entities = [], nameKey = 'name') {
  const normalizedText = normalizeChatText(text)

  return [...entities]
    .filter((entity) => entity?.[nameKey])
    .sort((left, right) => String(right[nameKey]).length - String(left[nameKey]).length)
    .find((entity) => includesPhrase(normalizedText, entity[nameKey])) || null
}

export function resolveWalletSelection(text = '', wallets = []) {
  return findMentionedEntity(text, wallets, 'name')
}

export function resolveWalletForMessage({
  text = '',
  wallets = [],
  walletRules = [],
  analysisWallet = null,
}) {
  const activeWallets = wallets.filter((wallet) => !wallet?.is_archived)
  const explicitWallet = findMentionedEntity(text, activeWallets, 'name')
  if (explicitWallet) {
    return { wallet: explicitWallet, resolution: 'explicit' }
  }

  const analysisCandidate = String(analysisWallet || '').trim()
  const matchedAnalysisWallet = analysisCandidate
    ? findWalletByName(activeWallets, analysisCandidate)
    : null

  if (analysisCandidate && textIncludesCandidate(text, analysisCandidate)) {
    if (matchedAnalysisWallet) {
      return { wallet: matchedAnalysisWallet, resolution: 'analysis_explicit' }
    }

    return {
      wallet: null,
      resolution: 'explicit_missing',
      missingName: formatDisplayName(analysisCandidate),
    }
  }

  const learnedWallet = findRuleMatch({
    text,
    rules: walletRules,
    entities: activeWallets,
    idKey: 'wallet_id',
  })

  if (learnedWallet) {
    return {
      wallet: learnedWallet.entity,
      resolution: 'learned',
      keyword: learnedWallet.rule.keyword,
    }
  }

  if (activeWallets.length === 1) {
    return { wallet: activeWallets[0], resolution: 'single_default' }
  }

  if (activeWallets.length === 0) {
    return { wallet: null, resolution: 'none' }
  }

  return { wallet: null, resolution: 'needs_clarification' }
}

export function resolveCategoryForMessage({
  text = '',
  categories = [],
  categoryRules = [],
  analysisCategory = null,
  transactionType = 'expense',
}) {
  const fallbackCategory = findFallbackCategory(categories)
  const explicitCategory = resolveExistingCategory(categories, extractExplicitCategoryName(text, categories), transactionType)

  if (explicitCategory.category) {
    return createCategoryResolution({
      category: explicitCategory.category,
      resolution: 'explicit',
    })
  }

  const learnedCategory = findRuleMatch({
    text,
    rules: categoryRules,
    entities: categories.filter((category) => isCompatibleCategory(category, transactionType)),
    idKey: 'category_id',
  })

  if (learnedCategory) {
    return createCategoryResolution({
      category: learnedCategory.entity,
      resolution: 'learned',
      keyword: learnedCategory.rule.keyword,
    })
  }

  const analysisResolution = resolveExistingCategory(
    categories,
    String(analysisCategory || '').trim(),
    transactionType
  )

  if (analysisResolution.category) {
    return createCategoryResolution({
      category: analysisResolution.category,
      resolution: 'analysis',
    })
  }

  const inferredCategory = inferCategoryFromText({
    text,
    analysisCategory,
    transactionType,
  })

  if (inferredCategory.categoryName) {
    const inferredResolution = resolveExistingCategory(
      categories,
      inferredCategory.categoryName,
      transactionType
    )

    if (inferredResolution.category) {
      return createCategoryResolution({
        category: inferredResolution.category,
        resolution: analysisCategory ? 'analysis_semantic' : 'semantic',
        keyword: inferredCategory.matchedKeyword,
      })
    }

    const createCategory = buildAutoCategoryPayload({
      categoryName: inferredCategory.categoryName,
      text,
      analysisCategory,
      transactionType,
    })

    if (createCategory) {
      return createCategoryResolution({
        category: null,
        categoryName: createCategory.name,
        resolution: analysisCategory ? 'analysis_create' : 'semantic_create',
        keyword: inferredCategory.matchedKeyword,
        createCategory,
      })
    }
  }

  const customCategoryPayload = buildAutoCategoryPayload({
    categoryName: '',
    text,
    analysisCategory,
    transactionType,
  })

  if (customCategoryPayload) {
    return createCategoryResolution({
      category: null,
      categoryName: customCategoryPayload.name,
      resolution: 'analysis_create',
      createCategory: customCategoryPayload,
    })
  }

  return createCategoryResolution({
    category: fallbackCategory,
    categoryName: fallbackCategory?.name || 'Lainnya',
    resolution: 'fallback',
    ambiguous: analysisResolution.ambiguous,
  })
}

export function resolveTransactionWithLearning({
  text = '',
  analysis = null,
  wallets = [],
  categories = [],
  walletRules = [],
  categoryRules = [],
}) {
  const isAnalysisTransaction = analysis?.type === 'transaction'
  const amount = Number(isAnalysisTransaction ? analysis.amount : extractAmountFromText(text))

  if (!amount) {
    return null
  }

  const transactionType = isAnalysisTransaction
    ? analysis.transactionType
    : detectTransactionTypeFromText(text)

  const walletResolution = resolveWalletForMessage({
    text,
    wallets,
    walletRules,
    analysisWallet: isAnalysisTransaction ? analysis.wallet : null,
  })

  const categoryResolution = resolveCategoryForMessage({
    text,
    categories,
    categoryRules,
    analysisCategory: isAnalysisTransaction ? analysis.category : null,
    transactionType,
  })

  if (!isAnalysisTransaction && !walletResolution.wallet && !categoryResolution.category) {
    return null
  }

  const categoryName =
    categoryResolution.category?.name ||
    categoryResolution.createCategory?.name ||
    categoryResolution.categoryName ||
    'Lainnya'

  return {
    type: 'transaction',
    transactionType,
    amount,
    desc: isAnalysisTransaction && analysis.desc
      ? analysis.desc
      : buildTransactionDescription(text, {
          transactionType,
          categoryName,
          walletName: walletResolution.wallet?.name || null,
        }),
    category: categoryName,
    wallet: walletResolution.wallet?.name || null,
    walletResolution,
    categoryResolution,
    derivedFromLearning: !isAnalysisTransaction,
  }
}

export function buildWalletClarificationReply({
  draft,
  wallets = [],
  formatRupiah,
}) {
  const walletNames = wallets
    .filter((wallet) => !wallet?.is_archived)
    .map((wallet) => wallet.name)
    .slice(0, 4)

  const actionLabel = draft?.transactionType === 'income' ? 'masukkan' : 'catat'
  const amountLabel = typeof formatRupiah === 'function'
    ? formatRupiah(draft?.amount || 0)
    : `Rp ${draft?.amount || 0}`

  return `Mau saya ${actionLabel} ${amountLabel} ke dompet yang mana?\n\nPilih salah satu: ${walletNames.join(', ')}.`
}

function buildTransactionDescription(text, { transactionType, categoryName = null, walletName = null } = {}) {
  let desc = String(text || '')
    .replace(MONEY_REGEX, ' ')
    .replace(COMMAND_WORDS, ' ')

  if (walletName) {
    desc = removePhrase(desc, walletName)
  }

  if (categoryName) {
    desc = removePhrase(desc, categoryName)
  }

  desc = desc.replace(/\s+/g, ' ').trim()

  if (!desc) {
    return categoryName || (transactionType === 'income' ? 'Pemasukan' : 'Pengeluaran')
  }

  return formatDisplayName(desc)
}

function createCategoryResolution({
  category = null,
  categoryName = null,
  resolution = 'fallback',
  keyword = null,
  createCategory = null,
  ambiguous = false,
}) {
  return {
    category,
    categoryName: category?.name || categoryName || createCategory?.name || 'Lainnya',
    resolution,
    keyword,
    createCategory,
    ambiguous,
  }
}

function extractExplicitCategoryName(text, categories = []) {
  const explicitCategory = findMentionedEntity(
    text,
    categories,
    'name'
  )

  return explicitCategory?.name || ''
}

function findRuleMatch({ text, rules = [], entities = [], idKey }) {
  const normalizedText = normalizeChatText(text)
  const entityMap = new Map(
    entities
      .filter((entity) => entity?.id)
      .map((entity) => [entity.id, entity])
  )

  return [...rules]
    .filter((rule) => rule?.[idKey] && rule?.keyword)
    .sort(compareRules)
    .map((rule) => ({
      rule,
      entity: entityMap.get(rule[idKey]) || null,
    }))
    .find(({ rule, entity }) => entity && includesPhrase(normalizedText, rule.keyword)) || null
}

function compareRules(left, right) {
  const usageDelta = Number(right?.usage_count || 0) - Number(left?.usage_count || 0)
  if (usageDelta !== 0) return usageDelta

  const updatedLeft = new Date(left?.updated_at || 0).getTime()
  const updatedRight = new Date(right?.updated_at || 0).getTime()
  if (updatedRight !== updatedLeft) {
    return updatedRight - updatedLeft
  }

  return String(right?.keyword || '').length - String(left?.keyword || '').length
}

function findWalletByName(wallets, name) {
  const normalizedName = normalizeChatText(name)

  return wallets.find((wallet) => normalizeChatText(wallet?.name) === normalizedName) ||
    wallets.find((wallet) => includesPhrase(wallet?.name, normalizedName)) ||
    null
}

function includesPhrase(text, phrase) {
  const normalizedText = ` ${normalizeChatText(text)} `
  const normalizedPhrase = normalizeChatText(phrase)

  if (!normalizedPhrase) {
    return false
  }

  return normalizedText.includes(` ${normalizedPhrase} `)
}

function textIncludesCandidate(text, candidate) {
  return includesPhrase(text, candidate)
}

function removePhrase(text, phrase) {
  const normalizedPhrase = String(phrase || '').trim()
  if (!normalizedPhrase) {
    return text
  }

  const escapedPhrase = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return String(text).replace(new RegExp(`\\b${escapedPhrase}\\b`, 'ig'), ' ')
}

function formatDisplayName(value) {
  const normalized = normalizeCategoryLookup(value)
  if (!normalized) {
    return ''
  }

  return normalized
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function isCompatibleCategory(category, transactionType) {
  const categoryType = String(category?.category_type || 'both').toLowerCase()
  return categoryType === 'both' || categoryType === String(transactionType || 'expense').toLowerCase()
}
