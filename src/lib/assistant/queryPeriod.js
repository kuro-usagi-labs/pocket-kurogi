import { resolveDateEntities } from './dateResolver'

// Query ranges are half-open: the next day's midnight belongs to the next day.
export function resolveQueryPeriod(text = '', now = new Date()) {
  const value = text.toLowerCase()
  const current = new Date(now)
  let start = new Date(current.getFullYear(), current.getMonth(), current.getDate())
  let end = new Date(start)
  let label
  const rolling = value.match(/\b(\d+) hari terakhir\b/u)
  const isoRange = value.match(/\b(\d{4}-\d{2}-\d{2})\s*(?:sampai|hingga|s\/d|s\.d\.)\s*(\d{4}-\d{2}-\d{2})\b/u)
  if (isoRange) {
    const dates = [isoRange[1], isoRange[2]].map((date) => resolveDateEntities(date, now).find((item) => item.source === 'explicit_iso'))
    if (dates.some((date) => !date) || dates[0].value > dates[1].value) return { invalid: true }
    start = new Date(dates[0].value); start.setHours(0, 0, 0, 0)
    end = new Date(dates[1].value); end.setHours(0, 0, 0, 0); end.setDate(end.getDate() + 1)
    label = `${isoRange[1]} sampai ${isoRange[2]}`
  } else if (rolling) {
    const days = Number(rolling[1])
    if (!Number.isSafeInteger(days) || days < 1 || days > 400) return { invalid: true }
    start.setDate(start.getDate() - days + 1)
    end.setDate(end.getDate() + 1)
    label = `${days} hari terakhir`
  } else if (/\b(?:minggu|pekan) (?:ini|lalu|kemarin)\b/u.test(value)) {
    start.setDate(start.getDate() - (start.getDay() + 6) % 7)
    const previous = /\b(?:lalu|kemarin)\b/u.test(value)
    if (previous) start.setDate(start.getDate() - 7)
    end = new Date(start); end.setDate(end.getDate() + 7)
    label = previous ? 'minggu lalu' : 'minggu ini'
  } else if (/\bbulan (?:ini|lalu|kemarin)\b/u.test(value)) {
    const previous = /\bbulan (?:lalu|kemarin)\b/u.test(value)
    start = new Date(current.getFullYear(), current.getMonth() - Number(previous), 1)
    end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
    label = previous ? 'bulan lalu' : 'bulan ini'
  } else {
    const date = resolveDateEntities(text, now)[0]
    if (!date) return null
    start = new Date(date.value); start.setHours(0, 0, 0, 0)
    end = new Date(start); end.setDate(end.getDate() + 1)
    label = /\bkemarin\b/u.test(value) ? 'kemarin' : /\b(?:hari ini|tadi|barusan)\b/u.test(value) ? 'hari ini' : `tanggal ${start.toLocaleDateString('id-ID')}`
  }
  return { startAt: start.toISOString(), endAt: end.toISOString(), periodLabel: label }
}
