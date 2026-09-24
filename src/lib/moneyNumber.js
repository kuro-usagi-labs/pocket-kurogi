// Accept whole numeric tokens so grouping separators cannot split one amount.
export function parseRupiahAmount(numberText, unit = '') {
  const normalized = normalizeMoneyNumber(numberText)
  const scales = { '': 1, rupiah: 1, perak: 1, k: 1000, rb: 1000, ribu: 1000, jt: 1000000, juta: 1000000, m: 1000000000, miliar: 1000000000 }
  const scale = scales[String(unit || '').toLowerCase()]
  if (normalized === null || scale === undefined) return null
  const amount = Number(normalized) * scale
  if (!Number.isFinite(amount) || amount < 0 || amount > Number.MAX_SAFE_INTEGER / 100) return null
  return Math.round(amount * 100) / 100
}

export function normalizeMoneyNumber(value = '') {
  const text = String(value).trim()
  if (/^\d+$/.test(text)) return text
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(text)) return text.replace(/,/g, '')
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(text)) return text.replace(/\./g, '').replace(',', '.')
  if (/^\d+[.,]\d{1,2}$/.test(text)) return text.replace(',', '.')
  return null
}
