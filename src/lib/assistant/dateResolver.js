import { normalizeIndonesianFinanceText } from '../indonesianFinanceLanguage'

const MONTHS = Object.freeze({
  januari: 0,
  februari: 1,
  maret: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  agustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  desember: 11,
})

const DAY_PERIODS = Object.freeze({
  'tadi pagi': [9, 0],
  'tadi siang': [13, 0],
  'tadi sore': [17, 0],
  'tadi malam': [20, 0],
  'kemarin pagi': [9, 0],
  'kemarin siang': [13, 0],
  'kemarin sore': [17, 0],
  'kemarin malam': [20, 0],
})

export function resolveDateEntities(text = '', now = new Date()) {
  const normalized = normalizeIndonesianFinanceText(text)
  const reference = new Date(now)
  const entities = []

  const isoMatch = normalized.match(/\b(\d{4})-(\d{2})-(\d{2})\b/u)
  if (isoMatch) {
    pushDateEntity(entities, {
      raw: isoMatch[0],
      date: createValidDate(
        Number(isoMatch[1]),
        Number(isoMatch[2]) - 1,
        Number(isoMatch[3]),
        reference
      ),
      precision: 'day',
      source: 'explicit_iso',
    })
  }

  const numericMatch = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/u)
  if (numericMatch) {
    const year = numericMatch[3]
      ? normalizeYear(Number(numericMatch[3]))
      : reference.getFullYear()
    pushDateEntity(entities, {
      raw: numericMatch[0],
      date: createValidDate(year, Number(numericMatch[2]) - 1, Number(numericMatch[1]), reference),
      precision: 'day',
      source: 'explicit_numeric',
    })
  }

  const namedMonthMatch = normalized.match(
    /\b(?:tanggal\s+)?(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)(?:\s+(\d{4}))?\b/u
  )
  if (namedMonthMatch) {
    pushDateEntity(entities, {
      raw: namedMonthMatch[0],
      date: createValidDate(
        Number(namedMonthMatch[3] || reference.getFullYear()),
        MONTHS[namedMonthMatch[2]],
        Number(namedMonthMatch[1]),
        reference
      ),
      precision: 'day',
      source: 'explicit_named_month',
    })
  }

  const dayOnlyMatch = normalized.match(/\b(?:tanggal|tgl)\s+(\d{1,2})\b/u)
  if (dayOnlyMatch && !namedMonthMatch) {
    pushDateEntity(entities, {
      raw: dayOnlyMatch[0],
      date: createValidDate(
        reference.getFullYear(),
        reference.getMonth(),
        Number(dayOnlyMatch[1]),
        reference
      ),
      precision: 'day',
      source: 'explicit_day',
    })
  }

  const relative = resolveRelativeDate(normalized, reference)
  if (relative) pushDateEntity(entities, relative)

  return entities
}

export function resolvePrimaryDate(text = '', now = new Date()) {
  return resolveDateEntities(text, now)[0] || {
    raw: null,
    value: new Date(now).toISOString(),
    date: new Date(now),
    precision: 'instant',
    source: 'default_now',
    confidence: 0.5,
  }
}

function resolveRelativeDate(text, now) {
  for (const [phrase, [hours, minutes]] of Object.entries(DAY_PERIODS)) {
    if (!text.includes(phrase)) continue
    const date = startOfDay(now)
    if (phrase.startsWith('kemarin')) date.setDate(date.getDate() - 1)
    date.setHours(hours, minutes, 0, 0)
    return {
      raw: phrase,
      date,
      precision: 'day_period',
      source: 'relative',
    }
  }

  if (/\bdua hari lalu\b/u.test(text)) {
    const date = startOfDay(now)
    date.setDate(date.getDate() - 2)
    return { raw: 'dua hari lalu', date, precision: 'day', source: 'relative' }
  }

  if (/\bkemarin\b/u.test(text)) {
    const date = startOfDay(now)
    date.setDate(date.getDate() - 1)
    return { raw: 'kemarin', date, precision: 'day', source: 'relative' }
  }

  if (/\b(?:hari ini|tadi|barusan|baru saja)\b/u.test(text)) {
    return {
      raw: text.match(/\b(?:hari ini|tadi|barusan|baru saja)\b/u)?.[0] || 'hari ini',
      date: new Date(now),
      precision: 'instant',
      source: 'relative',
    }
  }

  return null
}

function pushDateEntity(entities, candidate) {
  if (!candidate.date || Number.isNaN(candidate.date.getTime())) return
  entities.push({
    ...candidate,
    value: candidate.date.toISOString(),
    confidence: candidate.source.startsWith('explicit') ? 0.99 : 0.94,
  })
}

function createValidDate(year, month, day, reference) {
  const date = new Date(
    year,
    month,
    day,
    reference.getHours(),
    reference.getMinutes(),
    reference.getSeconds(),
    reference.getMilliseconds()
  )

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

function normalizeYear(year) {
  return year < 100 ? 2000 + year : year
}

function startOfDay(value) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}
