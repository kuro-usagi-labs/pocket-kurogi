// Accept whole numeric tokens so grouping separators cannot split one amount.
export function normalizeMoneyNumber(value = '') {
  const text = String(value).trim()
  if (/^\d+$/.test(text)) return text
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(text)) return text.replace(/,/g, '')
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(text)) return text.replace(/\./g, '').replace(',', '.')
  if (/^\d+[.,]\d{1,2}$/.test(text)) return text.replace(',', '.')
  return null
}
