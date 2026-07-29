import { inferCategoryFromText } from './categoryCatalog'
import { normalizeEntityName, resolveOptionReference } from './chatEntities'
import { classifyFinanceIntent } from './financeIntentClassifier'

const MONEY_PATTERN = /(^|[^\p{L}\p{N}])(?:rp\s*)?(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)\s*(ribu|rb|k|juta|jt|m)?(?![\p{L}\p{N}])/giu
const RECORD_PATTERN = /\b(catat|catet|simpan|rekam|input|masuk(?:kan)?|tambah(?:kan)?)\b/iu
const RECORD_REFERENCE_PATTERN = /\b(tadi|itu|tersebut|barusan|sebelumnya|hasil(?:nya)?|yang sama)\b/iu
const CANCEL_DRAFT_PATTERN = /\b(batal|cancel|lupakan|hapus draft|tidak jadi|ga jadi|gak jadi|jangan catat|tidak usah dicatat)\b/iu
const HYPOTHETICAL_PATTERN = /\b(kalau|jika|misal|seandainya|rencana|berencana|nanti|besok|akan|mau beli|ingin beli)\b/iu
const QUESTION_PATTERN = /\b(berapa|berarti|jadi berapa|hitung|apakah|cukup|bisa nggak|bisa gak|bisa ga|gimana|bagaimana)\b|\?\s*$/iu
const PERMISSION_QUESTION_PATTERN = /\b(boleh(?:kah)?|apakah|bisakah|bisa\s+(?:tidak|nggak|gak|ga))\b/iu
const TRANSACTION_VERB_PATTERN = /\b(beli|bayar|belanja|jajan|makan|minum|isi|topup|terima|gaji|bonus|pengeluaran|pemasukan)\b/iu
const CHANGE_PATTERN = /\b(kembalian|kembali|susuk|uang balik|baliknya)\b/iu
const TENDER_TAIL_PATTERN = /\b(?:pakai|pake|bayar|kasih|bawa|serahkan)(?:\s+(?:dengan|sebesar))?(?:\s+uang)?\s*$/iu
const NEGATED_ALTERNATIVE_PATTERN = /\bbukan\b.+\b(?:tapi|melainkan)\b/iu
const NON_MONEY_PREFIX_PATTERN = /\b(tanggal|tgl|jam|pukul|umur|usia|nomor|no|sebanyak|jumlah|qty)\s*$/iu
const QUANTITY_PREFIX_PATTERN = /\b(beli|pesan|ambil|butuh|mau)\s*$/iu
const NON_MONEY_SUFFIX_PATTERN = /^\s*(?:(liter|kg|kilogram|gram|gr|ml|buah|pcs|orang|km|hari|bulan|tahun|kali|botol|bungkus|porsi|pack|lusin|persen)\b|%)/iu
const LOW_BALANCE_PATTERN = /(?:\b(?:uang|saldo|dompet|rekening)\b.{0,35}\b(?:tinggal|sisa|cuma|hanya|menipis|hampir habis)\b|\b(?:tinggal|sisa|cuma|hanya)\b.{0,20}\b(?:rp\s*)?\d).{0,55}\b(?:sebulan|akhir bulan|sampai gajian|buat bulan|untuk bulan|prioritas|hemat|cukup|gimana|bagaimana)\b/iu
const NON_OCCURRENCE_PATTERN = /(?:\b(?:jangan|tidak|belum|hampir)\s+(?:jadi\s+)?(?:beli|bayar|belanja|jajan|terima|dapat|masuk|keluar|catat)\b|\b(?:gaji|bonus|uang)\b.{0,18}\bbelum\s+masuk\b)/iu
const META_EXAMPLE_PATTERN = /\b(contoh(?:\s+kalimat)?|sekadar contoh|cuma contoh|abaikan(?:\s+pesan)?|jangan ikuti|simulasi)\b/iu
const THIRD_PARTY_TRANSACTION_PATTERN = /\b(teman|istri|suami|adik|kakak|ibu|ayah|dia|mereka)\b.{0,18}\b(beli|bayar|belanja|jajan|terima)\b/iu
const PRICE_CHECK_PATTERN = /\b(?:cek|lihat|bandingkan|tanya)\s+(?:harga|biaya)\b|\bharga\b.{0,30}\b(?:berapa|saja)\b/iu
const EXPLICIT_DATE_PATTERN = /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/u
const CASH_WORD_PATTERN = /\b(tunai|cash|uang kontan)\b/iu
const GENERIC_WALLET_WORDS = new Set(['uang', 'saldo', 'cash', 'tunai', 'dompet', 'rekening', 'wallet'])

const CATEGORY_PRIORITY = [
  { pattern: /\b(jajan|snack|camilan|cemilan|ngemil)\b/iu, category: 'Jajan' },
  { pattern: /\b(bensin|bbm|pertalite|pertamax|solar|spbu)\b/iu, category: 'Bensin' },
  { pattern: /\b(makan|makanan|sarapan|nasi|lauk|warteg)\b/iu, category: 'Makan' },
  { pattern: /\b(kopi|ngopi|latte|americano|cappuccino)\b/iu, category: 'Kopi' },
  { pattern: /\b(parkir|tol|gojek|grab|ojek|transport)\b/iu, category: 'Transport' },
  { pattern: /\b(listrik|pln|internet|wifi|tagihan|pdam)\b/iu, category: 'Tagihan' },
  { pattern: /\b(obat|vitamin|dokter|klinik|apotek|kesehatan)\b/iu, category: 'Kesehatan' },
  { pattern: /\b(gaji|salary|upah)\b/iu, category: 'Gaji' },
  { pattern: /\b(bonus|komisi|cashback|refund)\b/iu, category: 'Bonus' },
  { pattern: /\b(alfamart|indomaret|minimarket|supermarket|belanja)\b/iu, category: 'Belanja' },
]

const ESSENTIAL_CATEGORIES = new Set([
  'makan',
  'bensin',
  'transport',
  'tagihan',
  'kesehatan',
  'rumah',
  'pendidikan',
])

function normalizeFinanceText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(pke|pake|pk)\b/giu, 'pakai')
    .replace(/\b(catetin|catet|catatkan|inputin)\b/giu, 'catat')
    .replace(/\b(kembaliannya|susuk)\b/giu, 'kembalian')
    .replace(/\b(dapet)\b/giu, 'dapat')
    .replace(/\b(gak|ga|nggak|enggak)\b/giu, 'tidak')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseMoneyValue(rawNumber, unit = '') {
  const normalizedNumber = String(rawNumber || '')
  const numeric = normalizedNumber.includes('.') && /^\d{1,3}(?:\.\d{3})+$/.test(normalizedNumber)
    ? Number(normalizedNumber.replace(/\./g, ''))
    : Number(normalizedNumber.replace(',', '.'))
  const normalizedUnit = String(unit || '').toLowerCase()

  if (!Number.isFinite(numeric) || numeric <= 0) return 0
  if (['k', 'rb', 'ribu'].includes(normalizedUnit)) return numeric * 1000
  if (['jt', 'juta'].includes(normalizedUnit)) return numeric * 1000000
  if (normalizedUnit === 'm') return numeric * 1000000000
  return numeric < 1000 ? numeric * 1000 : numeric
}

export function extractMoneyMentions(text = '') {
  const normalizedText = normalizeFinanceText(text)
  const mentions = []
  MONEY_PATTERN.lastIndex = 0

  for (const match of normalizedText.matchAll(MONEY_PATTERN)) {
    const leadingBoundary = match[1] || ''
    const start = (match.index || 0) + leadingBoundary.length
    const rawMoney = match[0].slice(leadingBoundary.length)
    const end = start + rawMoney.length
    const explicitUnit = String(match[3] || '').toLowerCase() || null
    const prefix = normalizedText.slice(Math.max(0, start - 45), start)
    const suffix = normalizedText.slice(end, Math.min(normalizedText.length, end + 20))
    const previousCharacter = normalizedText[start - 1] || ''
    const nextCharacter = normalizedText[end] || ''
    const clausePrefix = prefix.split(/[,;]|\b(?:dan|sama|terus|lalu|kemudian)\b/iu).at(-1) || prefix

    if (!explicitUnit && (
      NON_MONEY_PREFIX_PATTERN.test(prefix) ||
      NON_MONEY_SUFFIX_PATTERN.test(suffix) ||
      QUANTITY_PREFIX_PATTERN.test(prefix) && /^\s*[\p{L}]/u.test(suffix) ||
      /[/:]/u.test(previousCharacter) ||
      /[/:]/u.test(nextCharacter)
    )) {
      continue
    }

    let role = 'item'
    if (CHANGE_PATTERN.test(clausePrefix)) {
      const lastChangeIndex = Math.max(
        clausePrefix.lastIndexOf('kembalian'),
        clausePrefix.lastIndexOf('kembali'),
        clausePrefix.lastIndexOf('susuk'),
        clausePrefix.lastIndexOf('uang balik')
      )
      const tailAfterChange = lastChangeIndex >= 0 ? clausePrefix.slice(lastChangeIndex) : clausePrefix
      if (!/[,;]/u.test(tailAfterChange)) role = 'change'
    }

    if (role === 'item' && (TENDER_TAIL_PATTERN.test(clausePrefix) || /\buang\s*$/iu.test(clausePrefix))) {
      role = 'tender'
    }

    mentions.push({
      raw: rawMoney,
      number: match[2],
      unit: explicitUnit,
      explicitUnit: Boolean(explicitUnit),
      inferredUnit: !explicitUnit && Number(String(match[2]).replace(',', '.')) < 1000 ? 'ribu' : null,
      value: parseMoneyValue(match[2], explicitUnit),
      role,
      start,
      end,
    })
  }

  return mentions.filter((mention) => Number.isSafeInteger(mention.value) && mention.value > 0)
}

function findExplicitWallets(text, walletOptions = []) {
  let remainingText = ` ${normalizeEntityName(text)} `
  const matches = []
  const sortedOptions = [...walletOptions].sort(
    (left, right) => normalizeEntityName(right.name).length - normalizeEntityName(left.name).length
  )

  for (const wallet of sortedOptions) {
    const normalizedName = normalizeEntityName(wallet.name)
    if (!normalizedName) continue
    const needle = ` ${normalizedName} `
    if (!remainingText.includes(needle)) continue

    matches.push(wallet)
    remainingText = remainingText.split(needle).join(' ')
  }

  return matches
}

function hasExplicitWalletCue(text = '') {
  return /\b(dari|via|pakai|pake|menggunakan|dompet|rekening|wallet|tunai|cash)\b/iu.test(text)
}

function hasRevisionWalletReference(text = '', walletOptions = []) {
  if (findExplicitWallets(text, walletOptions).length > 0) return true
  if (/\b(dompet|rekening|wallet|tunai|cash)\b/iu.test(text)) return true

  const sourceMatch = normalizeFinanceText(text).match(/\b(?:dari|via|pakai|pake|menggunakan)\s+([\p{L}][\p{L}\p{N}-]*)/iu)
  if (!sourceMatch?.[1]) return false

  return !CATEGORY_PRIORITY.some(({ pattern }) => pattern.test(sourceMatch[1]))
}

function resolveWalletFromText(text, walletOptions = []) {
  const preparedOptions = walletOptions.map((wallet) => ({
    ...wallet,
    normalizedName: wallet.normalizedName || normalizeEntityName(wallet.name),
  }))
  const explicitWallets = findExplicitWallets(text, preparedOptions)
  if (explicitWallets.length === 1) {
    return { wallet: explicitWallets[0], candidates: explicitWallets, reason: 'explicit' }
  }
  if (explicitWallets.length > 1) {
    return { wallet: null, candidates: explicitWallets, reason: 'multiple_explicit' }
  }

  const resolution = resolveOptionReference({ input: text, options: preparedOptions })
  const normalized = normalizeFinanceText(text)
  if (CASH_WORD_PATTERN.test(normalized) || /\bpakai uang\b/iu.test(normalized)) {
    const cashWallets = preparedOptions.filter((wallet) =>
      wallet.walletType === 'cash' || /\b(tunai|cash)\b/iu.test(wallet.name)
    )
    if (cashWallets.length === 1) {
      return { wallet: cashWallets[0], candidates: cashWallets, reason: 'cash_semantic' }
    }

    return {
      wallet: null,
      candidates: cashWallets,
      reason: cashWallets.length > 1 ? 'ambiguous_cash' : 'explicit_missing',
    }
  }

  if (hasExplicitWalletCue(normalized)) {
    return {
      wallet: null,
      candidates: resolution.candidates || [],
      reason: resolution.candidates?.length ? 'ambiguous' : 'explicit_missing',
    }
  }

  if (preparedOptions.length === 1) {
    return { wallet: preparedOptions[0], candidates: preparedOptions, reason: 'single' }
  }

  return {
    wallet: null,
    candidates: resolution.candidates || [],
    reason: resolution.candidates?.length ? 'ambiguous' : 'missing',
  }
}

function isDirectWalletChoice(text, wallet) {
  if (!wallet?.name) return false

  const fillerWords = new Set([
    'pakai',
    'dari',
    'pilih',
    'yang',
    'dompet',
    'rekening',
    'wallet',
    'aja',
    'saja',
    'ya',
    'deh',
    'dong',
    'ok',
    'oke',
  ])
  const selection = normalizeEntityName(text)
    .split(/\s+/)
    .filter((word) => word && !fillerWords.has(word))
    .join(' ')

  return selection === normalizeEntityName(wallet.name)
}

function inferPriorityCategory(text = '', transactionType = 'expense') {
  const priorityMatch = CATEGORY_PRIORITY.find(({ pattern }) => pattern.test(text))
  if (priorityMatch) return priorityMatch.category

  const inferred = inferCategoryFromText({ text, transactionType })
  return inferred.categoryName || (transactionType === 'income' ? 'Pemasukan' : 'Lainnya')
}

function inferTransactionTypeForCategory(category = '', fallback = 'expense') {
  const normalizedCategory = normalizeEntityName(category)

  if (['gaji', 'bonus'].includes(normalizedCategory)) return 'income'
  if (CATEGORY_PRIORITY.some((entry) => normalizeEntityName(entry.category) === normalizedCategory)) {
    return 'expense'
  }

  return fallback
}

function cleanItemDescription(fragment = '', category = 'Lainnya') {
  const cleaned = String(fragment || '')
    .replace(/\b(tadi|hari ini|saya|aku|gue|kami|terus|lalu|kemudian|dan|sama)\b/giu, ' ')
    .replace(/\b(tolong|mohon|catat|simpan|rekam|input|masukkan|tambahkan)\b/giu, ' ')
    .replace(/\b(beli|bayar|untuk|buat|sebesar)\b/giu, ' ')
    .replace(/[^\p{L}\p{N}&'-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const fallback = category === 'Lainnya' ? 'Pengeluaran' : category
  return toTitleCase(cleaned || fallback)
}

function toTitleCase(value = '') {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function findClauseBoundary(normalizedText, mention, previousMentionEnd = 0) {
  const prefix = normalizedText.slice(0, mention.start)
  const delimiterPattern = /[,;]|\b(?:dan|sama|terus|lalu|kemudian)\b/giu
  let delimiterEnd = 0

  for (const delimiter of prefix.matchAll(delimiterPattern)) {
    delimiterEnd = (delimiter.index || 0) + delimiter[0].length
  }

  return Math.max(delimiterEnd, previousMentionEnd)
}

function buildItemFrames(text, mentions, occurredAt = null) {
  const normalizedText = normalizeFinanceText(text)
  const frames = []
  let previousMentionEnd = 0

  for (const mention of mentions) {
    if (mention.role !== 'item') {
      previousMentionEnd = Math.max(previousMentionEnd, mention.end)
      continue
    }

    const boundary = findClauseBoundary(normalizedText, mention, previousMentionEnd)
    const fragment = normalizedText.slice(boundary, mention.start).trim()
    previousMentionEnd = mention.end

    if (!fragment || !TRANSACTION_VERB_PATTERN.test(fragment) && !CATEGORY_PRIORITY.some(({ pattern }) => pattern.test(fragment))) {
      continue
    }

    const transactionType = /\b(gaji|bonus|komisi|pemasukan|terima|cashback|refund)\b/iu.test(fragment)
      ? 'income'
      : 'expense'
    const category = inferPriorityCategory(fragment, transactionType)
    frames.push({
      clientItemId: `item-${frames.length + 1}`,
      transactionType,
      amount: mention.value,
      desc: cleanItemDescription(fragment, category),
      category,
      rawText: fragment,
      occurredAt,
      confidence: mention.explicitUnit ? 0.99 : 0.94,
    })
  }

  return frames
}

function findMerchant(text = '') {
  const normalized = normalizeFinanceText(text)
  const merchantMatch = normalized.match(
    /\b(?:ke|di)\s+(.+?)(?=\s+(?:jajan|belanja|makan|ngopi|beli|bayar|pakai)\b|[,;]|$)/iu
  )
  if (!merchantMatch?.[1]) return null

  const merchant = merchantMatch[1]
    .split(/\s+/)
    .filter((word) => !GENERIC_WALLET_WORDS.has(word))
    .slice(0, 3)
    .join(' ')

  return merchant ? toTitleCase(merchant) : null
}

function buildDerivedPurchase(text, amount, occurredAt = null) {
  const category = inferPriorityCategory(text, 'expense')
  const merchant = findMerchant(text)
  return {
    clientItemId: 'item-1',
    transactionType: 'expense',
    amount,
    desc: merchant ? `${category} di ${merchant}` : category,
    category,
    merchant,
    rawText: [category, merchant].filter(Boolean).join(' '),
    occurredAt,
    confidence: 0.99,
  }
}

function resolveOccurredAt(text, now = new Date()) {
  if (!/\bkemarin\b/iu.test(text)) return null

  const occurredAt = new Date(now)
  occurredAt.setDate(occurredAt.getDate() - 1)
  return occurredAt.toISOString()
}

function hasSuspiciousAttachedNumber(text = '') {
  MONEY_PATTERN.lastIndex = 0
  const withoutMoney = normalizeFinanceText(text).replace(MONEY_PATTERN, '$1')
  MONEY_PATTERN.lastIndex = 0
  return /[\p{L}]\d|\d[\p{L}]/u.test(withoutMoney)
}

function formatRupiahDefault(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function attachWallet(items, wallet) {
  return items.map((item) => ({
    ...item,
    walletId: wallet?.id || item.walletId || null,
    wallet: wallet?.name || item.wallet || null,
  }))
}

function createDraft({ items, wallet = null, arithmetic = null, status = 'proposed', missingSlots = [] }) {
  return {
    version: 1,
    status,
    items: attachWallet(items, wallet),
    walletId: wallet?.id || null,
    wallet: wallet?.name || null,
    arithmetic,
    missingSlots,
  }
}

function buildWalletPrompt(walletOptions = [], total = 0) {
  const names = walletOptions.map((wallet) => wallet.name).filter(Boolean).slice(0, 5)
  const totalLabel = formatRupiahDefault(total)
  return names.length
    ? `Total **${totalLabel}** siap dicatat. Uangnya keluar dari dompet mana? Pilih: ${names.join(', ')}.`
    : `Total **${totalLabel}** siap dicatat, tetapi belum ada dompet aktif. Buat dompet terlebih dahulu.`
}

function resumeDraftFromContext({ text, context, walletOptions }) {
  if (!context?.items?.length) return null

  if (CANCEL_DRAFT_PATTERN.test(text) || /^(tidak|no|nggak|gak|ga)$/iu.test(text.trim())) {
    return {
      type: 'finance_draft_cancel',
      draftId: context.id || context.requestId || null,
      reply: 'Baik, hasil perhitungan tadi tidak saya catat.',
    }
  }

  if (
    /\b(tadi|barusan|draft|hasil)\b/iu.test(text) &&
    /\b(harusnya|seharusnya|ternyata|ubah|ganti|jadi)\b/iu.test(text) ||
    RECORD_PATTERN.test(text) && RECORD_REFERENCE_PATTERN.test(text) && extractMoneyMentions(text).length > 0
  ) {
    const correctionMentions = extractMoneyMentions(text)
    const normalizedReference = normalizeFinanceText(text)
    const explicitCategoryMatch = CATEGORY_PRIORITY.find(({ pattern }) => pattern.test(normalizedReference))
    const hasRevisionWalletCue = hasRevisionWalletReference(normalizedReference, walletOptions)
    const revisionWalletResolution = hasRevisionWalletCue
      ? resolveWalletFromText(normalizedReference, walletOptions)
      : { wallet: null, candidates: [], reason: 'unchanged' }
    const explicitIncome = /\b(?:sebagai\s+)?pemasukan\b/iu.test(normalizedReference)
    const explicitExpense = /\b(?:sebagai\s+)?pengeluaran\b/iu.test(normalizedReference)
    const matchingIndexes = context.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        const label = normalizeEntityName([item.category, item.desc].filter(Boolean).join(' '))
        return label.split(/\s+/).some((word) => word.length >= 4 && normalizedReference.includes(word))
      })
      .map(({ index }) => index)
    const targetIndex = context.items.length === 1
      ? 0
      : matchingIndexes.length === 1
        ? matchingIndexes[0]
        : -1

    if (context.items.length > 1 && hasRevisionWalletCue) {
      return {
        type: 'unknown',
        reply: 'Perubahan dompet untuk draft multi-item perlu dipisahkan per transaksi. Batalkan draft ini lalu catat ulang per dompet agar debitnya tidak tertukar.',
      }
    }

    if (correctionMentions.length === 1 && targetIndex >= 0) {
      const categoryTransactionType = explicitCategoryMatch
        ? inferTransactionTypeForCategory(
            explicitCategoryMatch.category,
            context.items[targetIndex].transactionType
          )
        : context.items[targetIndex].transactionType
      const nextTransactionType = explicitIncome
        ? 'income'
        : explicitExpense
          ? 'expense'
          : categoryTransactionType
      const changesTransactionType = nextTransactionType !== context.items[targetIndex].transactionType
      const nextItems = context.items.map((item, index) =>
        index === targetIndex
          ? {
              ...item,
              amount: correctionMentions[0].value,
              transactionType: nextTransactionType,
              ...(hasRevisionWalletCue
                ? {
                    walletId: revisionWalletResolution.wallet?.id || null,
                    wallet: revisionWalletResolution.wallet?.name || null,
                  }
                : {}),
              ...(explicitCategoryMatch
                ? {
                    category: explicitCategoryMatch.category,
                    desc: explicitCategoryMatch.category,
                    rawText: explicitCategoryMatch.category,
                  }
                : {}),
              ...(changesTransactionType && !explicitCategoryMatch
                ? {
                    category: nextTransactionType === 'income' ? 'Pemasukan' : 'Lainnya',
                    desc: nextTransactionType === 'income' ? 'Pemasukan' : 'Pengeluaran',
                    rawText: nextTransactionType === 'income' ? 'Pemasukan' : 'Pengeluaran',
                  }
                : {}),
            }
          : item
      )
      const needsWallet = hasRevisionWalletCue && !revisionWalletResolution.wallet ||
        context.missingSlots?.includes('wallet') && !context.walletId
      const nextWallet = hasRevisionWalletCue ? revisionWalletResolution.wallet : null
      const nextMissingSlots = needsWallet
        ? ['wallet']
        : (context.missingSlots || []).filter((slot) => slot !== 'wallet')
      const nextTypeLabel = nextItems[targetIndex].transactionType === 'income' ? 'pemasukan' : 'pengeluaran'
      const nextWalletLabel = nextItems[targetIndex].wallet
        ? ` dari dompet ${nextItems[targetIndex].wallet}`
        : needsWallet
          ? ' (dompet masih perlu dipilih)'
          : ''
      return {
        type: 'finance_draft_revision',
        previousDraftId: context.id || context.requestId || null,
        draft: {
          ...context,
          id: undefined,
          requestId: undefined,
          createdAt: undefined,
          expiresAt: undefined,
          status: needsWallet ? 'needs_wallet' : 'proposed',
          walletId: hasRevisionWalletCue ? nextWallet?.id || null : context.walletId || null,
          wallet: hasRevisionWalletCue ? nextWallet?.name || null : context.wallet || null,
          missingSlots: nextMissingSlots,
          arithmetic: null,
          items: nextItems,
        },
        reply: `Baik, draft saya ubah menjadi ${nextTypeLabel} ${formatRupiahDefault(correctionMentions[0].value)} untuk ${nextItems[targetIndex].desc || nextItems[targetIndex].category}${nextWalletLabel}. Belum ada saldo yang diubah.`,
      }
    }

    return {
      type: 'unknown',
      reply: 'Saya belum bisa menentukan item draft mana yang ingin dikoreksi. Sebutkan satu item dan nominal finalnya, misalnya “makan yang tadi harusnya 12rb”.',
    }
  }

  const walletResolution = resolveWalletFromText(text, walletOptions)
  const selectsWallet = context.status === 'needs_wallet' &&
    walletResolution.wallet &&
    isDirectWalletChoice(text, walletResolution.wallet)
  const commitsPrevious = RECORD_PATTERN.test(text) && (
    RECORD_REFERENCE_PATTERN.test(text) ||
    /^(?:ok\s+|oke\s+)?(?:catat|simpan|rekam|masukkan)(?:\s+(?:ya|saja|aja))?$/iu.test(text.trim())
  )
  const confirmsWithWallet = context.status === 'needs_wallet' &&
    walletResolution.wallet &&
    RECORD_PATTERN.test(text)

  if (
    context.status === 'needs_wallet' &&
    !walletResolution.wallet &&
    walletResolution.candidates.length > 0 &&
    normalizeEntityName(text).split(/\s+/).length <= 2
  ) {
    return {
      type: 'finance_draft',
      draft: context,
      reply: `Nama dompetnya masih ambigu. Pilih salah satu: ${walletResolution.candidates.map((wallet) => wallet.name).join(', ')}.`,
    }
  }

  if (!selectsWallet && !commitsPrevious && !confirmsWithWallet) return null

  if (hasExplicitWalletCue(text) && !walletResolution.wallet) {
    return {
      type: 'finance_draft',
      draft: {
        ...context,
        status: 'needs_wallet',
        walletId: null,
        wallet: null,
        missingSlots: ['wallet'],
        items: context.items.map((item) => ({ ...item, walletId: null, wallet: null })),
      },
      reply: walletResolution.candidates.length > 0
        ? `Dompet yang disebut masih ambigu. Pilih salah satu: ${walletResolution.candidates.map((wallet) => wallet.name).join(', ')}.`
        : 'Dompet yang disebut belum ditemukan. Pilih salah satu dompet aktif yang tersedia.',
    }
  }

  const wallet = walletResolution.wallet ||
    walletOptions.find((option) => option.id === context.walletId) ||
    null
  const total = context.items.reduce((sum, item) => sum + Number(item.amount || 0), 0)

  if (!wallet) {
    return {
      type: 'finance_draft',
      draft: {
        ...context,
        status: 'needs_wallet',
        missingSlots: ['wallet'],
      },
      reply: buildWalletPrompt(walletOptions, total),
    }
  }

  return {
    type: 'transaction_batch',
    items: attachWallet(context.items, wallet),
    walletId: wallet.id,
    wallet: wallet.name,
    requestId: context.requestId || context.id,
    draftId: context.id || context.requestId,
    arithmetic: context.arithmetic || null,
    derivedFromDraft: true,
  }
}

export function analyzeConversationalFinance({
  text = '',
  walletOptions = [],
  context = null,
  financialState = {},
  now = new Date(),
} = {}) {
  const normalizedText = normalizeFinanceText(text)
  if (!normalizedText) return null

  const resumed = resumeDraftFromContext({ text: normalizedText, context, walletOptions })
  if (resumed) return resumed

  if (CANCEL_DRAFT_PATTERN.test(normalizedText)) {
    return {
      type: 'unknown',
      reply: 'Baik, tidak ada transaksi baru yang saya catat dari pesan itu.',
    }
  }

  if (
    NON_OCCURRENCE_PATTERN.test(normalizedText) ||
    META_EXAMPLE_PATTERN.test(normalizedText) ||
    PRICE_CHECK_PATTERN.test(normalizedText) ||
    THIRD_PARTY_TRANSACTION_PATTERN.test(normalizedText) && !RECORD_PATTERN.test(normalizedText)
  ) {
    return {
      type: 'unknown',
      reply: 'Pesan itu terdengar seperti transaksi yang tidak terjadi, contoh, pengecekan, atau aktivitas orang lain. Saya tidak mencatat apa pun. Jika memang milikmu dan sudah terjadi, tulis ulang nominal final lalu tambahkan “tolong catat”.',
    }
  }

  if (LOW_BALANCE_PATTERN.test(normalizedText)) {
    const mentions = extractMoneyMentions(normalizedText)
    return {
      type: 'liquidity_advice',
      reply: buildLiquidityAdvice({
        balance: Number(mentions[0]?.value || financialState.totalBalance || 0),
        statedBalance: mentions[0]?.value || null,
        budgets: financialState.budgets || [],
        now,
        horizonDays: /\b(?:buat|untuk|selama)\s+(?:satu\s+)?sebulan\b/iu.test(normalizedText)
          ? 30
          : null,
      }),
    }
  }

  const mentions = extractMoneyMentions(normalizedText)
  const hasChangeLanguage = CHANGE_PATTERN.test(normalizedText)
  const classifier = classifyFinanceIntent(normalizedText)
  const commitRequested = RECORD_PATTERN.test(normalizedText) && !CANCEL_DRAFT_PATTERN.test(normalizedText)
  const isQuestion = QUESTION_PATTERN.test(normalizedText)
  const isPermissionQuestion = PERMISSION_QUESTION_PATTERN.test(normalizedText)
  const occurredAt = resolveOccurredAt(normalizedText, now)

  if (EXPLICIT_DATE_PATTERN.test(normalizedText) && commitRequested) {
    return {
      type: 'unknown',
      reply: 'Saya melihat tanggal eksplisit, tetapi format waktunya belum cukup aman untuk dicatat otomatis. Gunakan “hari ini” atau “kemarin”, atau catat lewat formulir histori.',
    }
  }

  if (NEGATED_ALTERNATIVE_PATTERN.test(normalizedText) && mentions.length > 0) {
    return {
      type: 'unknown',
      reply: 'Saya menangkap ada koreksi “bukan ... tapi ...”. Agar tidak mencatat item yang salah, tulis ulang hanya rincian final yang benar.',
    }
  }

  if (hasChangeLanguage) {
    const tenderMentions = mentions.filter((mention) => mention.role === 'tender')
    const changeMentions = mentions.filter((mention) => mention.role === 'change')
    const tender = tenderMentions[0]
    const change = changeMentions[0]

    if (!tender || !change || tenderMentions.length !== 1 || changeMentions.length !== 1) {
      return {
        type: 'unknown',
        reply: 'Saya menangkap konteks kembalian, tetapi perlu tepat satu nominal uang bayar dan satu nominal kembalian agar bisa menghitung dengan aman.',
      }
    }

    if (change.value > tender.value) {
      return {
        type: 'unknown',
        reply: `Kembaliannya ${formatRupiahDefault(change.value)} lebih besar dari uang bayar ${formatRupiahDefault(tender.value)}. Tolong periksa lagi angkanya; belum ada transaksi yang dicatat.`,
      }
    }

    const spent = tender.value - change.value
    const items = buildItemFrames(normalizedText, mentions, occurredAt)
    const itemTotal = items.reduce((sum, item) => sum + item.amount, 0)
    const itemMentionCount = mentions.filter((mention) => mention.role === 'item').length

    if (itemMentionCount > 0 && items.length !== itemMentionCount) {
      return {
        type: 'unknown',
        reply: 'Ada nominal tambahan yang belum bisa saya pasangkan ke item tertentu. Saya belum mencatat apa pun; tulis ulang setiap item beserta nominalnya.',
      }
    }

    if (items.length > 0 && itemTotal !== spent) {
      return {
        type: 'unknown',
        reply: `Angkanya belum konsisten: total rincian ${formatRupiahDefault(itemTotal)}, sedangkan ${formatRupiahDefault(tender.value)} dikurangi kembalian ${formatRupiahDefault(change.value)} adalah ${formatRupiahDefault(spent)}. Saya belum mencatat apa pun.`,
      }
    }

    const derivedItems = items.length > 0 ? items : [buildDerivedPurchase(normalizedText, spent, occurredAt)]
    const explicitWallets = findExplicitWallets(normalizedText, walletOptions)
    if (explicitWallets.length > 1) {
      return {
        type: 'unknown',
        reply: 'Saya menemukan lebih dari satu dompet dalam satu rincian. Agar tidak salah debit, pisahkan perintah per dompet atau gunakan satu dompet yang sama untuk batch ini.',
      }
    }
    const walletResolution = resolveWalletFromText(normalizedText, walletOptions)
    const arithmetic = {
      tenderAmount: tender.value,
      changeAmount: change.value,
      spentAmount: spent,
    }
    const draft = createDraft({
      items: derivedItems,
      wallet: walletResolution.wallet,
      arithmetic,
    })

    if (!commitRequested || isQuestion || isPermissionQuestion) {
      const purchaseLabel = derivedItems[0]?.category === 'Jajan' ? 'jajan' : 'belanja'
      return {
        type: 'finance_calculation',
        draft,
        reply: `${formatRupiahDefault(tender.value)} dikurangi kembalian ${formatRupiahDefault(change.value)} = **${formatRupiahDefault(spent)}**. Berarti tadi kamu ${purchaseLabel} sebesar **${formatRupiahDefault(spent)}**. Kalau mau, bilang “catat pengeluaran tadi”.`,
      }
    }

    if (!walletResolution.wallet) {
      return {
        type: 'finance_draft',
        draft: { ...draft, status: 'needs_wallet', missingSlots: ['wallet'] },
        reply: buildWalletPrompt(walletOptions, spent),
      }
    }

    return {
      type: 'transaction_batch',
      items: attachWallet(derivedItems, walletResolution.wallet),
      walletId: walletResolution.wallet.id,
      wallet: walletResolution.wallet.name,
      arithmetic,
      classifier,
    }
  }

  const itemFrames = buildItemFrames(normalizedText, mentions, occurredAt)
  const tender = mentions.find((mention) => mention.role === 'tender')
  const itemMentionCount = mentions.filter((mention) => mention.role === 'item').length
  const explicitWallets = findExplicitWallets(normalizedText, walletOptions)

  if (itemFrames.length > 0 && itemFrames.length !== itemMentionCount) {
    return {
      type: 'unknown',
      reply: 'Ada lebih dari satu angka dalam rincian dan saya belum bisa memastikan mana jumlah barang serta mana harga. Saya tidak mencatat apa pun; tulis harga tiap item dengan “rb”, misalnya “beras 75rb”.',
    }
  }

  if (itemFrames.length > 0 && explicitWallets.length > 1) {
    return {
      type: 'unknown',
      reply: 'Saya menemukan lebih dari satu dompet dalam satu batch. Pisahkan transaksi per dompet agar setiap debit masuk ke sumber yang benar.',
    }
  }

  if (itemFrames.length >= 2 || tender && itemFrames.length >= 1 || commitRequested && itemFrames.length >= 1) {
    const total = itemFrames.reduce((sum, item) => sum + item.amount, 0)
    if (tender && tender.value < total) {
      return {
        type: 'unknown',
        reply: `Rincian belanja berjumlah ${formatRupiahDefault(total)}, lebih besar dari uang bayar ${formatRupiahDefault(tender.value)}. Saya belum mencatat apa pun; tolong periksa nominalnya.`,
      }
    }

    const walletResolution = resolveWalletFromText(normalizedText, walletOptions)
    const arithmetic = tender
      ? {
          tenderAmount: tender.value,
          changeAmount: tender.value - total,
          spentAmount: total,
        }
      : { spentAmount: total }
    const draft = createDraft({ items: itemFrames, wallet: walletResolution.wallet, arithmetic })

    if (isPermissionQuestion || isQuestion && !commitRequested) {
      return {
        type: 'finance_calculation',
        draft,
        reply: `Total rincian tadi **${formatRupiahDefault(total)}**. Belum saya catat; bilang “catat pengeluaran tadi” kalau sudah benar.`,
      }
    }

    if (!commitRequested) {
      return {
        type: 'finance_calculation',
        draft,
        reply: `Saya menemukan ${itemFrames.length} rincian dengan total **${formatRupiahDefault(total)}**, tetapi belum mencatatnya karena belum ada perintah yang pasti. Jika benar, bilang “catat pengeluaran tadi”.`,
      }
    }

    if (!walletResolution.wallet) {
      return {
        type: 'finance_draft',
        draft: { ...draft, status: 'needs_wallet', missingSlots: ['wallet'] },
        reply: buildWalletPrompt(walletOptions, total),
      }
    }

    return {
      type: 'transaction_batch',
      items: attachWallet(itemFrames, walletResolution.wallet),
      walletId: walletResolution.wallet.id,
      wallet: walletResolution.wallet.name,
      arithmetic,
      classifier,
    }
  }

  if (hasChangeLanguage || classifier.label === 'calculate_change') {
    return {
      type: 'unknown',
      reply: 'Untuk menghitung kembalian, tulis uang bayar dan kembaliannya. Contoh: “bayar 50rb, kembali 36rb”.',
    }
  }

  if (tender && itemFrames.length === 0) {
    return {
      type: 'unknown',
      reply: 'Saya baru menemukan uang yang dipakai untuk membayar, belum nominal harga itemnya. Uang bayar tidak saya anggap sebagai pengeluaran.',
    }
  }

  if (
    itemFrames.length === 1 &&
    !commitRequested &&
    (/\b(tadi|barusan|kemarin|hari ini)\b/iu.test(normalizedText) || hasSuspiciousAttachedNumber(normalizedText))
  ) {
    const walletResolution = resolveWalletFromText(normalizedText, walletOptions)
    const draft = createDraft({
      items: itemFrames,
      wallet: walletResolution.wallet,
      arithmetic: { spentAmount: itemFrames[0].amount },
    })
    return {
      type: 'finance_calculation',
      draft,
      reply: `Saya menangkap pengeluaran **${formatRupiahDefault(itemFrames[0].amount)}**, tetapi belum mencatatnya. Jika sudah benar, bilang “catat pengeluaran tadi”.`,
    }
  }

  if (
    mentions.length === 0 &&
    hasSuspiciousAttachedNumber(normalizedText) &&
    TRANSACTION_VERB_PATTERN.test(normalizedText)
  ) {
    return {
      type: 'unknown',
      reply: 'Saya melihat angka yang menempel pada nama produk atau satuan, tetapi belum menemukan nominal uang yang aman. Tulis harga dengan “rb”, misalnya “iPhone15 20rb”.',
    }
  }

  if (mentions.length > 0 && (isPermissionQuestion || isQuestion && !commitRequested)) {
    return {
      type: 'unknown',
      reply: 'Saya menangkap ini sebagai pertanyaan, jadi belum mencatat transaksi apa pun. Jika ingin dicatat, sebutkan nominal, dompet, lalu tambahkan “tolong catat”.',
    }
  }

  if (HYPOTHETICAL_PATTERN.test(normalizedText) && mentions.length > 0 && !commitRequested) {
    return {
      type: 'unknown',
      reply: 'Saya menangkap ini sebagai rencana atau skenario, jadi tidak ada transaksi yang dicatat.',
    }
  }

  return null
}

export function derivePendingFinanceDraft(messages = [], now = new Date()) {
  let latestDraft = null

  for (const message of messages) {
    const metadata = message?.metadata && typeof message.metadata === 'object' ? message.metadata : {}
    const draft = metadata.financeDraft
    if (draft?.id && Array.isArray(draft.items)) {
      latestDraft = draft
    }

    const closedId = metadata.financeDraftResolved || metadata.financeDraftCancelled
    if (closedId && latestDraft?.id === closedId) latestDraft = null
  }

  const currentTime = new Date(now).getTime()
  if (!latestDraft) return null
  if (latestDraft.expiresAt && new Date(latestDraft.expiresAt).getTime() <= currentTime) return null
  return latestDraft
}

export function buildLiquidityAdvice({
  balance = 0,
  statedBalance = null,
  budgets = [],
  now = new Date(),
  horizonDays = null,
  formatRupiah = formatRupiahDefault,
} = {}) {
  const available = Math.max(Number(statedBalance ?? balance ?? 0), 0)
  if (available <= 0) {
    return 'Saldo likuid belum cukup untuk dibuatkan rencana. Prioritaskan pemasukan atau bantuan darurat untuk makan, transport kerja, kesehatan, dan tagihan wajib; hentikan dulu Jajan, Kopi, serta Hiburan.'
  }

  const current = new Date(now)
  const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate()
  const daysRemaining = Number(horizonDays) > 0
    ? Math.max(Math.round(Number(horizonDays)), 1)
    : Math.max(lastDay - current.getDate() + 1, 1)
  const essentialBudget = budgets.reduce((sum, budget) => {
    const categoryName = normalizeEntityName(budget?.categories?.name || budget?.category || '')
    return ESSENTIAL_CATEGORIES.has(categoryName)
      ? sum + Math.max(Number(budget?.monthly_limit || budget?.limit || 0), 0)
      : sum
  }, 0)
  const reserve = essentialBudget > 0
    ? Math.min(available, essentialBudget)
    : Math.round(available * 0.7)
  const discretionary = Math.max(available - reserve, 0)
  const rawDaily = Math.floor(available / daysRemaining / 1000) * 1000
  const safeDaily = Math.floor(discretionary / daysRemaining / 1000) * 1000
  const severity = rawDaily < 15000 || safeDaily < 5000 ? 'critical' : rawDaily < 30000 ? 'tight' : 'watch'

  const opening = `Saldo likuid **${formatRupiah(available)}** untuk **${daysRemaining} hari** setara sekitar **${formatRupiah(rawDaily)} per hari** sebelum kebutuhan wajib.`
  const action = severity === 'critical'
    ? 'Ini sudah masuk mode bertahan: hentikan dulu **Jajan, Kopi, dan Hiburan**.'
    : severity === 'tight'
      ? 'Ruangnya ketat, jadi tahan dulu belanja impulsif dan batasi Jajan/Kopi.'
      : 'Masih perlu disiplin: beri batas khusus untuk pengeluaran fleksibel.'
  const priority = 'Urutkan uang untuk **makan dasar, bensin/transport kerja, kesehatan, lalu tagihan wajib**.'
  const allowance = `Setelah cadangan kebutuhan, jatah fleksibel yang lebih aman sekitar **${formatRupiah(safeDaily)} per hari**.`
  const assumption = essentialBudget > 0
    ? 'Saya memperlakukan budget kategori penting sebagai cadangan; sesuaikan jika sebagian tagihan sudah dibayar.'
    : 'Karena nominal tagihan wajib belum lengkap, saya menahan 70% saldo sebagai cadangan kebutuhan penting.'

  return [opening, action, priority, allowance, assumption].join('\n\n')
}
