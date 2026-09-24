import { normalizeMoneyNumber } from './moneyNumber'

export function parseAmountInput(value = '') {
  const text = String(value).trim().toLowerCase().replace(/^rp\s*/, '').replace(/\s+/g, '')
  const match = text.match(/^([\d.,]+)(k|rb|ribu|jt|juta|m)?$/)
  if (!match) return 0
  const numeric = normalizeMoneyNumber(match[1])
  if (numeric === null) return 0
  const scales = { k: 1000, rb: 1000, ribu: 1000, jt: 1000000, juta: 1000000, m: 1000000000 }
  const amount = Number(numeric) * (scales[match[2]] || 1)
  return Number.isFinite(amount) && amount > 0 && amount <= Number.MAX_SAFE_INTEGER / 100 ? Math.round(amount * 100) / 100 : 0
}
