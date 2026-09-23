import { expect, it } from 'vitest'
import { buildFinancialReport } from './financialReport'
import { createReportPdf } from './reportPdf'
it('exports all rows with repeating headers and numbered pages', async () => {
  const rows = Array.from({ length: 85 }, (_, i) => ({ id: String(i), amount: '15000.10', transaction_type: 'expense', analytics_bucket: 'expense', occurred_at: '2026-09-23T00:00:00Z', merchant: `Transaksi ${i}`, category_name: 'Makan', category_type: 'expense', wallet_name: 'Tunai' }))
  const doc = await createReportPdf(buildFinancialReport(rows, '2026-09'))
  expect(doc.getNumberOfPages()).toBeGreaterThan(3)
  expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(1000)
  expect(doc.lastAutoTable.body).toHaveLength(85)
})
