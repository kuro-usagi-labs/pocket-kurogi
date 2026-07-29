import { normalizeIndonesianFinanceText } from '../indonesianFinanceLanguage'

const MONEY_PATTERN =
  /(?:(?<currency>rp)\s*)?(?<number>\d+(?:[.,]\d+)?)\s*(?<unit>ribu|rb|k|juta|jt|miliar)?\b/giu
const FOREIGN_CURRENCY_PATTERN =
  /(?:us\$|\$|€|¥|£|₹|₩|฿|₱|₽|₫|₺)|\b(?:usd|dolar|dollar|eur|euro|sgd|yen|jpy|ringgit|myr|baht|won|krw|gbp|pound|yuan|cny|cad|aud|nzd|chf|hkd|twd|inr|rupee|peso|php|vnd|rub|try|btc|bitcoin|eth|ethereum|usdt|usdc)\b|\brm\s*(?=\d)/giu
const NON_MONEY_PRECEDING_PATTERN =
  /\b(?:tanggal|tgl|jam|pukul|iphone|galaxy|android|versi|seri|tipe|ukuran)\s*$/iu
const NON_MONEY_FOLLOWING_PATTERN =
  /^\s*(?:meter|m\b|cm\b|mm\b|km\b|botol|buah|orang|kali|lembar|pcs|unit|kg\b|gram|liter|ml\b|hari|minggu|bulan|tahun|jam|menit|detik)\b/iu
const QUANTITY_PRECEDING_PATTERN =
  /\b(?:beli|pesan|ambil|butuh|mau|ingin)\s*$/iu

export function extractMoneyEntities(text = '') {
  const normalized = normalizeIndonesianFinanceText(text)
  const entities = []

  for (const match of normalized.matchAll(MONEY_PATTERN)) {
    const raw = match[0]
    const start = match.index ?? 0
    const end = start + raw.length
    const currency = String(match.groups?.currency || '').toLowerCase()
    const unit = String(match.groups?.unit || '').toLowerCase()
    const before = normalized.slice(Math.max(0, start - 24), start)
    const after = normalized.slice(end, end + 24)
    const explicitCurrency = currency === 'rp'
    const explicitUnit = Boolean(unit)

    if (!explicitCurrency && !explicitUnit) {
      if (
        NON_MONEY_PRECEDING_PATTERN.test(before) ||
        NON_MONEY_FOLLOWING_PATTERN.test(after) ||
        (
          QUANTITY_PRECEDING_PATTERN.test(before) &&
          /^\s*[\p{L}]/u.test(after)
        ) ||
        !hasMoneyContext(normalized, start, end)
      ) {
        continue
      }
    }

    const parsedValue = parseMoneyValue(match.groups?.number, unit)
    const inferredUnit =
      !explicitCurrency &&
      !explicitUnit &&
      parsedValue > 0 &&
      parsedValue < 1_000
        ? 'ribu'
        : null
    const value = inferredUnit === 'ribu' ? parsedValue * 1_000 : parsedValue
    if (!Number.isFinite(value) || value <= 0) continue

    entities.push({
      raw,
      normalized: raw.toLowerCase().replace(/\s+/g, ''),
      value,
      currency: 'IDR',
      start,
      end,
      explicitCurrency,
      explicitUnit,
      unit: unit || inferredUnit,
      inferredUnit,
      confidence: explicitCurrency || explicitUnit ? 0.99 : 0.74,
      evidence: [
        explicitCurrency ? 'explicit_currency:rp' : null,
        explicitUnit
          ? `money_unit:${unit}`
          : inferredUnit
            ? 'inferred_money_unit:ribu'
            : 'contextual_bare_amount',
      ].filter(Boolean),
    })
  }

  return dedupeOverlappingEntities(entities)
}

export function extractForeignCurrencyEntities(text = '') {
  const normalized = String(text || '').toLowerCase()
  return Array.from(normalized.matchAll(FOREIGN_CURRENCY_PATTERN), (match) => ({
    raw: match[0],
    currency: match[0].toUpperCase(),
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }))
}

export function parseMoneyValue(numberText = '', unit = '') {
  let normalizedNumber = String(numberText || '').trim()

  if (/^\d{1,3}(?:\.\d{3})+$/.test(normalizedNumber)) {
    normalizedNumber = normalizedNumber.replace(/\./g, '')
  } else {
    normalizedNumber = normalizedNumber.replace(',', '.')
  }

  const numeric = Number(normalizedNumber)
  if (!Number.isFinite(numeric)) return 0

  const normalizedUnit = String(unit || '').toLowerCase()
  if (['k', 'rb', 'ribu'].includes(normalizedUnit)) return numeric * 1_000
  if (['jt', 'juta'].includes(normalizedUnit)) return numeric * 1_000_000
  if (normalizedUnit === 'miliar') return numeric * 1_000_000_000
  return numeric
}

function hasMoneyContext(text, start, end) {
  const context = text.slice(Math.max(0, start - 42), Math.min(text.length, end + 42))
  return /\b(?:bayar|dibayar|beli|belanja|jajan|makan|minum|harga|seharga|senilai|nominal|uang|saldo|gaji|bonus|terima|dapat|masuk|keluar|pengeluaran|pemasukan|transfer|kembalian|sisa|habis|catat|budget|anggaran|target|tabung)\b/iu.test(
    context
  )
}

function dedupeOverlappingEntities(entities) {
  return entities.filter((entity, index, all) => {
    return !all.some((candidate, candidateIndex) => {
      if (candidateIndex === index) return false
      const contains =
        candidate.start <= entity.start &&
        candidate.end >= entity.end &&
        candidate.end - candidate.start > entity.end - entity.start
      return contains
    })
  })
}
