import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import HistoryView from './HistoryView'

it.each([{ error: new Error('offline') }, { loading: true }])('does not claim empty finances before history is available: %s', props => {
  const html = renderToStaticMarkup(<HistoryView transactions={[]} formatRupiah={n => `Rp ${n}`} {...props} />)
  expect(html).not.toContain('Belum ada transaksi')
  expect(html).not.toContain('Rp 0')
  expect(html).toMatch(/role="(alert|status)"/)
})
