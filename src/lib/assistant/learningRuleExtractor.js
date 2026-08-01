import {
  formatCandidateNames,
  normalizeEntityName,
  resolveOptionReference,
} from '../chatEntities'

/**
 * Canonical specialist extractor for explicit keyword learning commands.
 * It never writes data or composes the final runtime response.
 */
export function extractLearningRuleCandidate({
  text = '',
  wallets = [],
  categories = [],
} = {}) {
  const input = String(text || '').trim()
  const forgetMatch = input.match(
    /^(?:lupakan(?:\s+(?:aturan|pelajaran|ingatan))?|hapus\s+(?:aturan|pelajaran|ingatan))(?:\s+(kategori|dompet|wallet))?(?:\s+(?:untuk|tentang|kata|istilah))?\s+["“]?(.+?)["”]?[.!]?$/iu
  )
  if (forgetMatch?.[2]) {
    const keyword = cleanLearningKeyword(forgetMatch[2])
    if (!keyword) return invalidCandidate('invalid_learning_keyword')
    return groundedCandidate({
      type: 'forget_learning_rule',
      keyword,
      ruleType: /dompet|wallet/iu.test(forgetMatch[1] || '')
        ? 'wallet'
        : /kategori/iu.test(forgetMatch[1] || '')
          ? 'category'
          : 'all',
      raw: forgetMatch[0],
    })
  }

  const categoryPair = matchTeachingPair(input, [
    /^(?:tolong\s+)?(?:ajari|ajarkan|ingat|ingatlah)(?:\s+(?:kamu|bot|kurogi))?(?:\s+bahwa)?\s+["“]?(.+?)["”]?\s+(?:itu\s+)?(?:artinya|berarti|masuk|sebagai)\s+kategori\s+["“]?(.+?)["”]?[.!]?$/iu,
    /^(?:mulai sekarang\s+)?kalau\s+(?:aku|saya)\s+bilang\s+["“]?(.+?)["”]?\s*,?\s+(?:anggap|masukkan|masukin|kategorikan)(?:\s+itu)?(?:\s+sebagai|\s+ke|\s+masuk)?\s+kategori\s+["“]?(.+?)["”]?[.!]?$/iu,
    /^(?:mulai sekarang\s+)?kalau\s+(?:aku|saya)\s+bilang\s+["“]?(.+?)["”]?\s*,?\s+(?:itu\s+)?(?:berarti|artinya|masuk)?\s*kategori(?:nya)?\s+["“]?(.+?)["”]?[.!]?$/iu,
  ])
  if (categoryPair) {
    return resolveTeachingTarget({
      type: 'teach_category_rule',
      pair: categoryPair,
      options: categories,
      targetLabel: 'kategori',
      idKey: 'categoryId',
      raw: input,
    })
  }

  const walletPair = matchTeachingPair(input, [
    /^(?:tolong\s+)?(?:ajari|ajarkan|ingat|ingatlah)(?:\s+(?:kamu|bot|kurogi))?(?:\s+bahwa)?\s+["“]?(.+?)["”]?\s+(?:itu\s+)?(?:artinya|berarti|gunakan|pakai)\s+(?:dompet|wallet|rekening)\s+["“]?(.+?)["”]?[.!]?$/iu,
    /^(?:mulai sekarang\s+)?kalau\s+(?:aku|saya)\s+bilang\s+["“]?(.+?)["”]?\s*,?\s+(?:pakai|gunakan)(?:\s+itu)?\s+(?:dompet|wallet|rekening)\s+["“]?(.+?)["”]?[.!]?$/iu,
    /^(?:mulai sekarang\s+)?kalau\s+(?:aku|saya)\s+bilang\s+["“]?(.+?)["”]?\s*,?\s+(?:maksudnya|artinya|berarti)\s+(?:pakai\s+)?(?:dompet|wallet|rekening)\s+["“]?(.+?)["”]?[.!]?$/iu,
  ])
  if (walletPair) {
    return resolveTeachingTarget({
      type: 'teach_wallet_rule',
      pair: walletPair,
      options: wallets,
      targetLabel: 'dompet',
      idKey: 'walletId',
      raw: input,
    })
  }

  if (/\b(?:ajari|ajarkan|lupakan aturan|kalau (?:aku|saya) bilang)\b/iu.test(input)) {
    return invalidCandidate('unsupported_learning_instruction')
  }
  return null
}

function resolveTeachingTarget({ type, pair, options, targetLabel, idKey, raw }) {
  if (!pair.keyword || !pair.targetName) {
    return invalidCandidate('invalid_learning_keyword')
  }
  const normalizedOptions = options.map((option) => ({
    ...option,
    normalizedName: normalizeEntityName(option.name),
  }))
  const resolution = resolveOptionReference({
    input: pair.targetName,
    options: normalizedOptions,
  })
  if (resolution.match) {
    return groundedCandidate({
      type,
      keyword: pair.keyword,
      [idKey]: resolution.match.id,
      targetName: resolution.match.name,
      raw,
    })
  }
  if (resolution.candidates.length > 0) {
    return invalidCandidate(
      'ambiguous_learning_target',
      `Nama ${targetLabel}nya masih ambigu. Maksudmu ${formatCandidateNames(resolution.candidates)}?`
    )
  }
  return invalidCandidate(
    'missing_learning_target',
    `Aku belum menemukan ${targetLabel} "${pair.targetName}". Buat atau pilih ${targetLabel} yang sudah ada dulu.`
  )
}

function matchTeachingPair(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match?.[1] || !match?.[2]) continue
    return {
      keyword: cleanLearningKeyword(match[1]),
      targetName: cleanLearningTarget(match[2]),
    }
  }
  return null
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
  ) return null
  return keyword
}

function cleanLearningTarget(value = '') {
  return String(value || '')
    .replace(/[.!?,]+$/u, '')
    .replace(/^["“”']+|["“”']+$/gu, '')
    .trim()
}

function groundedCandidate({ raw, ...fields }) {
  return {
    ...fields,
    kind: 'learning_rule',
    source: 'utterance',
    confidence: 0.99,
    evidence: [{
      type: fields.type,
      raw,
      start: 0,
      end: String(raw || '').length,
    }],
  }
}

function invalidCandidate(reason, reply = null) {
  return {
    type: 'unknown',
    kind: 'learning_rule_rejected',
    source: 'utterance',
    confidence: 1,
    reason,
    reply: reply || 'Aku belum menyimpan aturan itu. Gunakan istilah khusus sepanjang 2–48 karakter tanpa nominal, misalnya "ngopi" atau "makan kantor".',
    evidence: [],
  }
}
