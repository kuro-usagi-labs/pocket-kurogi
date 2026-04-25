const GENERIC_CATEGORY_LABELS = new Set([
  'lainnya',
  'lainya',
  'other',
  'misc',
  'expense',
  'pengeluaran',
  'income',
  'pemasukan',
  'transaction',
  'transaksi',
  'umum',
  'general',
])

const UPPERCASE_WORDS = new Set(['pln', 'bpjs', 'pbb', 'ppn', 'pdam'])

const CATEGORY_TEMPLATES = [
  {
    name: 'Makan',
    icon: 'ShoppingBag',
    color: '#F59E0B',
    categoryType: 'expense',
    aliases: [
      'makan',
      'makanan',
      'food',
      'meal',
      'lunch',
      'dinner',
      'sarapan',
      'breakfast',
      'restoran',
      'resto',
      'restaurant',
      'warteg',
      'bakso',
      'mie',
      'nasi',
      'ayam',
      'kfc',
      'mcd',
      'mcdonald',
      'burger',
      'pizza',
      'soto',
      'sate',
      'padang',
      'pecel',
      'gofood',
      'grabfood',
      'shopeefood',
    ],
  },
  {
    name: 'Kopi',
    icon: 'Coffee',
    color: '#92400E',
    categoryType: 'expense',
    aliases: [
      'kopi',
      'coffee',
      'ngopi',
      'cafe',
      'kafe',
      'latte',
      'espresso',
      'americano',
      'cappuccino',
      'starbucks',
      'fore',
      'tomoro',
      'kenangan',
      'janji jiwa',
      'kopken',
      'point coffee',
      'excelso',
    ],
  },
  {
    name: 'Jajan',
    icon: 'Pizza',
    color: '#F97316',
    categoryType: 'expense',
    aliases: [
      'jajan',
      'snack',
      'camilan',
      'cemilan',
      'ngemil',
      'roti',
      'biskuit',
      'wafer',
      'coklat',
      'permen',
      'es krim',
      'ice cream',
      'golda',
      'teh botol',
      'ultra milk',
      'indomilk',
      'pocari',
      'yakult',
      'minuman',
      'boba',
      'es teh',
      'esteh',
      'chatime',
      'mixue',
    ],
  },
  {
    name: 'Belanja',
    icon: 'ShoppingCart',
    color: '#8B5CF6',
    categoryType: 'expense',
    aliases: [
      'belanja',
      'shopping',
      'groceries',
      'grocery',
      'supermarket',
      'minimarket',
      'alfamart',
      'indomaret',
      'mart',
      'store',
      'toko',
      'market',
      'household',
      'keperluan',
      'shopee',
      'tokopedia',
      'lazada',
      'blibli',
      'tiktok shop',
      'mall',
    ],
  },
  {
    name: 'Transport',
    icon: 'Car',
    color: '#3B82F6',
    categoryType: 'expense',
    aliases: [
      'transport',
      'transportasi',
      'commute',
      'gojek',
      'gojek',
      'grab',
      'gocar',
      'goride',
      'ojek',
      'taxi',
      'bus',
      'kereta',
      'parkir',
      'tol',
      'travel',
      'perjalanan',
      'angkot',
      'mrt',
      'lrt',
      'krl',
      'transjakarta',
      'maxim',
      'in-drive',
    ],
  },
  {
    name: 'Bensin',
    icon: 'Car',
    color: '#EF4444',
    categoryType: 'expense',
    aliases: [
      'bensin',
      'bbm',
      'fuel',
      'pertalite',
      'pertamax',
      'solar',
      'spbu',
      'shell',
      'vpower',
      'oli',
      'servis motor',
      'service motor',
      'servis mobil',
      'service mobil',
    ],
  },
  {
    name: 'Tagihan',
    icon: 'Zap',
    color: '#F97316',
    categoryType: 'expense',
    aliases: [
      'tagihan',
      'bills',
      'bill',
      'listrik',
      'pln',
      'token',
      'air',
      'pdam',
      'internet',
      'wifi',
      'indihome',
      'subscription',
      'langganan',
      'bpjs',
      'ipl',
      'maintenance fee',
      'tagihan listrik',
      'token listrik',
      'telkom',
      'myrepublic',
      'biznet',
      'first media',
      'cicilan',
      'angsuran',
    ],
  },
  {
    name: 'Pulsa & Data',
    icon: 'Smartphone',
    color: '#2563EB',
    categoryType: 'expense',
    aliases: [
      'pulsa',
      'kuota',
      'data',
      'paket data',
      'paket internet',
      'topup pulsa',
      'top up pulsa',
      'isi pulsa',
      'sim card',
      'telkomsel',
      'xl',
      'axis',
      'indosat',
      'tri',
      'smartfren',
    ],
  },
  {
    name: 'Hiburan',
    icon: 'BadgeDollarSign',
    color: '#EC4899',
    categoryType: 'expense',
    aliases: [
      'hiburan',
      'entertainment',
      'movie',
      'film',
      'bioskop',
      'netflix',
      'spotify',
      'steam',
      'game',
      'gaming',
      'playstation',
      'xbox',
      'nonton',
      'youtube',
      'disney',
      'vidio',
      'prime video',
      'karaoke',
      'konser',
    ],
  },
  {
    name: 'Kesehatan',
    icon: 'HeartHandshake',
    color: '#10B981',
    categoryType: 'expense',
    aliases: [
      'kesehatan',
      'health',
      'obat',
      'dokter',
      'klinik',
      'rumah sakit',
      'medical',
      'vitamin',
      'apotik',
      'apotek',
      'halodoc',
      'alodokter',
      'laboratorium',
      'lab',
      'cek darah',
    ],
  },
  {
    name: 'Rumah',
    icon: 'Home',
    color: '#64748B',
    categoryType: 'expense',
    aliases: [
      'rumah',
      'home',
      'kos',
      'kontrakan',
      'sewa',
      'rent',
      'laundry',
      'perabot',
      'furnitur',
      'furniture',
      'bersih bersih',
      'cleaning',
      'galon',
      'gas',
      'lpg',
    ],
  },
  {
    name: 'Gaji',
    icon: 'Landmark',
    color: '#059669',
    categoryType: 'income',
    aliases: [
      'gaji',
      'salary',
      'payroll',
      'upah',
      'payday',
      'penghasilan',
      'pendapatan',
      'transfer masuk',
      'income kantor',
    ],
  },
  {
    name: 'Bonus',
    icon: 'Gift',
    color: '#14B8A6',
    categoryType: 'income',
    aliases: [
      'bonus',
      'thr',
      'reward',
      'cashback',
      'refund',
      'hadiah',
      'insentif',
      'rebate',
      'promo',
    ],
  },
  {
    name: 'Freelance',
    icon: 'BriefcaseBusiness',
    color: '#4F46E5',
    categoryType: 'income',
    aliases: [
      'freelance',
      'freelancer',
      'project',
      'proyek',
      'client',
      'komisi',
      'commission',
      'fee',
      'jasa',
      'side job',
    ],
  },
  {
    name: 'Investasi',
    icon: 'CircleDollarSign',
    color: '#0F766E',
    categoryType: 'income',
    aliases: [
      'investasi',
      'investment',
      'dividen',
      'return',
      'bunga',
      'interest',
      'yield',
      'capital gain',
    ],
  },
  {
    name: 'Lainnya',
    icon: 'Receipt',
    color: '#6B7280',
    categoryType: 'both',
    aliases: ['lainnya', 'other', 'misc'],
  },
]

export const DEFAULT_CATEGORY_TEMPLATES = CATEGORY_TEMPLATES.map((template) => ({
  name: template.name,
  icon: template.icon,
  color: template.color,
  categoryType: template.categoryType,
}))

const NORMALIZED_CATEGORY_TEMPLATES = CATEGORY_TEMPLATES.map((template) => ({
  ...template,
  normalizedName: normalizeCategoryLookup(template.name),
  normalizedAliases: [...new Set([template.name, ...template.aliases].map(normalizeCategoryLookup))].filter(Boolean),
}))

export function normalizeCategoryLookup(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function toDisplayCategoryName(value = '') {
  const normalized = normalizeCategoryLookup(value)
  if (!normalized) {
    return ''
  }

  return normalized
    .split(' ')
    .map((word) => {
      if (UPPERCASE_WORDS.has(word)) {
        return word.toUpperCase()
      }

      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

export function isCompatibleCategoryType(categoryType = 'both', transactionType = 'expense') {
  if (categoryType === 'both') {
    return true
  }

  return String(categoryType || 'both').toLowerCase() === String(transactionType || 'expense').toLowerCase()
}

export function filterCategoriesByType(categories = [], transactionType = 'expense') {
  return categories.filter((category) =>
    isCompatibleCategoryType(category?.category_type || 'both', transactionType)
  )
}

export function findFallbackCategory(categories = []) {
  return categories.find((category) => normalizeCategoryLookup(category?.name) === 'lainnya') || null
}

export function buildCategoryOptions(categories = []) {
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    normalizedName: normalizeCategoryLookup(category.name),
    categoryType: category.category_type || 'both',
    icon: category.icon || null,
    color: category.color || null,
  }))
}

export function getCategoryTemplate(categoryName = '', transactionType = 'expense') {
  const normalizedCategory = normalizeCategoryLookup(categoryName)
  if (!normalizedCategory) {
    return null
  }

  return (
    NORMALIZED_CATEGORY_TEMPLATES.find((template) => {
      if (!isCompatibleCategoryType(template.categoryType, transactionType)) {
        return false
      }

      return template.normalizedAliases.includes(normalizedCategory)
    }) || null
  )
}

export function resolveExistingCategory(categories = [], categoryName = '', transactionType = 'expense') {
  const normalizedCategory = normalizeCategoryLookup(categoryName)
  const compatibleCategories = filterCategoriesByType(categories, transactionType)

  if (!normalizedCategory) {
    return { category: null, ambiguous: false }
  }

  const exactMatch = compatibleCategories.find(
    (category) => normalizeCategoryLookup(category.name) === normalizedCategory
  )

  if (exactMatch) {
    return { category: exactMatch, ambiguous: false }
  }

  const template = getCategoryTemplate(normalizedCategory, transactionType)
  if (template) {
    const canonicalMatch = compatibleCategories.find(
      (category) => normalizeCategoryLookup(category.name) === template.normalizedName
    )

    if (canonicalMatch) {
      return { category: canonicalMatch, ambiguous: false }
    }

    const templateMatches = compatibleCategories.filter((category) => {
      const categoryTemplate =
        getCategoryTemplate(category.name, transactionType) ||
        inferCategoryTemplate({ text: category.name, transactionType })

      return categoryTemplate?.normalizedName === template.normalizedName
    })

    if (templateMatches.length === 1) {
      return { category: templateMatches[0], ambiguous: false }
    }

    if (templateMatches.length > 1) {
      return { category: null, ambiguous: true }
    }
  }

  const phraseMatches = compatibleCategories.filter((category) => {
    const normalizedExisting = normalizeCategoryLookup(category.name)
    return (
      includesPhrase(normalizedExisting, normalizedCategory) ||
      includesPhrase(normalizedCategory, normalizedExisting)
    )
  })

  if (phraseMatches.length === 1) {
    return { category: phraseMatches[0], ambiguous: false }
  }

  if (phraseMatches.length > 1) {
    return { category: null, ambiguous: true }
  }

  return { category: null, ambiguous: false }
}

export function inferCategoryTemplate({
  text = '',
  analysisCategory = '',
  transactionType = 'expense',
} = {}) {
  const haystack = normalizeCategoryLookup([analysisCategory, text].filter(Boolean).join(' '))
  const normalizedAnalysis = normalizeCategoryLookup(analysisCategory)

  if (!haystack) {
    return null
  }

  const scoredTemplates = NORMALIZED_CATEGORY_TEMPLATES
    .filter((template) => isCompatibleCategoryType(template.categoryType, transactionType))
    .map((template) => scoreTemplateMatch(template, haystack, normalizedAnalysis))
    .filter((match) => match.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return right.alias.length - left.alias.length
    })

  if (scoredTemplates.length === 0) {
    return null
  }

  const [best, runnerUp] = scoredTemplates
  if (runnerUp && best.score === runnerUp.score && best.alias.length === runnerUp.alias.length) {
    return null
  }

  return {
    name: best.template.name,
    normalizedName: best.template.normalizedName,
    icon: best.template.icon,
    color: best.template.color,
    categoryType: best.template.categoryType,
    matchedKeyword: best.alias,
  }
}

export function inferCategoryFromText({
  text = '',
  analysisCategory = '',
  transactionType = 'expense',
} = {}) {
  const template = inferCategoryTemplate({
    text,
    analysisCategory,
    transactionType,
  })

  if (!template) {
    return {
      categoryName: null,
      confidence: 'low',
      matchedKeyword: null,
    }
  }

  return {
    categoryName: template.name,
    categoryType: template.categoryType,
    icon: template.icon,
    color: template.color,
    matchedKeyword: template.matchedKeyword || null,
    confidence: 'high',
  }
}

export function buildAutoCategoryPayload({
  categoryName = '',
  text = '',
  analysisCategory = '',
  transactionType = 'expense',
} = {}) {
  const directTemplate =
    getCategoryTemplate(categoryName, transactionType) ||
    getCategoryTemplate(analysisCategory, transactionType) ||
    inferCategoryTemplate({
      text,
      analysisCategory: analysisCategory || categoryName,
      transactionType,
    })

  if (directTemplate) {
    return {
      name: directTemplate.name,
      icon: directTemplate.icon,
      color: directTemplate.color,
      categoryType: directTemplate.categoryType,
    }
  }

  const safeCustomLabel = sanitizeCustomCategoryLabel(
    analysisCategory || categoryName,
    transactionType
  )

  if (!safeCustomLabel) {
    return null
  }

  return {
    name: safeCustomLabel,
    icon: transactionType === 'income' ? 'CircleDollarSign' : 'Receipt',
    color: transactionType === 'income' ? '#0F766E' : '#6B7280',
    categoryType: transactionType === 'income' ? 'income' : 'expense',
  }
}

function sanitizeCustomCategoryLabel(value, transactionType) {
  const normalized = normalizeCategoryLookup(value)

  if (!normalized || GENERIC_CATEGORY_LABELS.has(normalized)) {
    return ''
  }

  const words = normalized.split(' ').filter(Boolean)
  if (words.length === 0 || words.length > 3) {
    return ''
  }

  if (!words.every((word) => word.length >= 2 && word.length <= 20 && !/^\d+$/.test(word))) {
    return ''
  }

  if (transactionType === 'income' && ['makan', 'kopi', 'jajan', 'belanja'].includes(words[0])) {
    return ''
  }

  return toDisplayCategoryName(normalized)
}

function scoreTemplateMatch(template, haystack, normalizedAnalysis) {
  let bestScore = 0
  let bestAlias = ''
  let totalScore = 0

  for (const alias of template.normalizedAliases) {
    if (!includesPhrase(haystack, alias)) {
      continue
    }

    let score = alias.length + alias.split(' ').length * 4

    if (normalizedAnalysis && alias === normalizedAnalysis) {
      score += 100
    } else if (normalizedAnalysis && includesPhrase(normalizedAnalysis, alias)) {
      score += 24
    }

    if (score > bestScore) {
      bestScore = score
      bestAlias = alias
    }

    totalScore += score
  }

  return {
    template,
    score: totalScore || bestScore,
    alias: bestAlias,
  }
}

function includesPhrase(text, phrase) {
  const normalizedText = ` ${normalizeCategoryLookup(text)} `
  const normalizedPhrase = normalizeCategoryLookup(phrase)

  if (!normalizedPhrase) {
    return false
  }

  return normalizedText.includes(` ${normalizedPhrase} `)
}
