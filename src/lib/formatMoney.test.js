import { it, expect } from 'vitest'
import { formatMoney } from './formatMoney'
import { formatRupiah } from './assistant/formatters'
it('preserves cents and zero without adding decimals to whole rupiah', () => {
  expect(formatMoney(400000.01)).toContain('400.000,01')
  expect(formatMoney(0)).toMatch(/Rp\s*0$/)
  expect(formatMoney(400000)).toMatch(/400\.000$/)
})
it('keeps assistant explanations at the same precision as the visible cards', () => {
  expect(formatRupiah(400000.01)).toContain('400.000,01')
})
