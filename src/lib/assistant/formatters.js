const IDR_FORMATTER = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatRupiah(value = 0) {
  return IDR_FORMATTER.format(Number(value || 0))
}

export function formatPercentage(value = 0, digits = 1) {
  return `${Number(value || 0).toFixed(digits)}%`
}

export function formatDateTime(value, locale = 'id-ID') {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatCompactList(values = []) {
  const items = values.map((value) => String(value || '').trim()).filter(Boolean)
  if (items.length <= 1) return items[0] || ''
  if (items.length === 2) return `${items[0]} dan ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, dan ${items.at(-1)}`
}

export function clampNumber(value, minimum = 0, maximum = 1) {
  return Math.min(Math.max(Number(value || 0), minimum), maximum)
}
