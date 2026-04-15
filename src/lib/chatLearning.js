const MONEY_REGEX = /(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta|m)?/i

const INCOME_KEYWORDS = /\b(gaji|bonus|dapat|terima|masuk|topup|cashback|refund|komisi|fee|pendapatan|income)\b/i
const COMMAND_WORDS = /\b(beli|bayar|buat|dari|terima|dapat|masuk|untuk|pakai|pake|di|ke|gaji|bonus|tabung|transfer|cairkan|cairin|tarik|ambil)\b/gi

export function normalizeChatText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
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
}) {
  const analysisName = String(analysisCategory || '').trim()
  if (analysisName && analysisName.toLowerCase() !== 'lainnya') {
    const matchedByAnalysis = findCategoryByName(categories, analysisName)
    if (matchedByAnalysis) {
      return { category: matchedByAnalysis, resolution: 'analysis' }
    }
  }

  const explicitCategory = findMentionedEntity(text, categories, 'name')
  if (explicitCategory) {
    return { category: explicitCategory, resolution: 'explicit' }
  }

  const learnedCategory = findRuleMatch({
    text,
    rules: categoryRules,
    entities: categories,
    idKey: 'category_id',
  })

  if (learnedCategory) {
    return {
      category: learnedCategory.entity,
      resolution: 'learned',
      keyword: learnedCategory.rule.keyword,
    }
  }

  return { category: null, resolution: 'default' }
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
  })

  if (!isAnalysisTransaction && !walletResolution.wallet && !categoryResolution.category) {
    return null
  }

  const fallbackCategory = isAnalysisTransaction ? analysis.category : null
  const categoryName =
    categoryResolution.category?.name ||
    (fallbackCategory && fallbackCategory.toLowerCase() !== 'lainnya'
      ? formatDisplayName(fallbackCategory)
      : 'Lainnya')

  return {
    type: 'transaction',
    transactionType,
    amount,
    desc: isAnalysisTransaction && analysis.desc
      ? analysis.desc
      : buildTransactionDescription(text, {
          transactionType,
          categoryName: categoryResolution.category?.name || fallbackCategory,
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

function findCategoryByName(categories, name) {
  const normalizedName = normalizeChatText(name)

  return categories.find((category) => normalizeChatText(category?.name) === normalizedName) ||
    categories.find((category) => includesPhrase(category?.name, normalizedName)) ||
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
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return ''
  }

  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
