import { describe, expect, it } from 'vitest'
import { parseAmountInput } from './transactionAmountInput'

describe('correction amount input', () => {
  it.each([['8.000', 8000], ['500', 500], ['Rp 8.000,50', 8000.5], ['8,000.50', 8000.5], ['2.860.097', 2860097], ['15k', 15000], ['1,5jt', 1500000], ['8..000', 0], ['-500', 0], ['', 0]])('%s becomes %s rupiah', (input, amount) => {
    expect(parseAmountInput(input)).toBe(amount)
  })
})
