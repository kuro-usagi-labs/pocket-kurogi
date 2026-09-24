import { parseRupiahAmount } from './moneyNumber'

export function parseAmountInput(value = '') {
  const text = String(value).trim().toLowerCase().replace(/^rp\s*/, '').replace(/\s+/g, '')
  const match = text.match(/^([\d.,]+)(k|rb|ribu|jt|juta|m|miliar|rupiah|perak)?$/)
  if (!match) return 0
  return parseRupiahAmount(match[1], match[2]) ?? 0
}
