import { expect, it } from 'vitest'
import { parseRupiahAmount } from './moneyNumber'
import { parseAmountInput } from './transactionAmountInput'
import { parseMoneyValue } from './assistant/moneyExtractor'
import { matchMoney, parseMoneyMatch } from './chatEntities'
import { extractAmountFromText } from './chatLearning'

it.each([['500', 500], ['8.000', 8000], ['2,860,097', 2860097], ['15k', 15000], ['1,5jt', 1500000], ['8.000,50', 8000.5]])('keeps %s consistent across chat and manual input', (text, expected) => {
  const match = matchMoney(`pengeluaran ${text} tunai`)
  expect(parseMoneyMatch(match)).toBe(expected)
  expect(parseMoneyValue(match[1], match[2] || '')).toBe(expected)
  expect(parseAmountInput(text)).toBe(expected)
  expect(extractAmountFromText(text)).toBe(expected)
})
it('rejects unsafe magnitude and malformed tokens', () => {
  expect(parseRupiahAmount('99999999999999999')).toBeNull()
  expect(parseRupiahAmount('8..000')).toBeNull()
  expect(parseRupiahAmount('500', 'unknown')).toBeNull()
})
