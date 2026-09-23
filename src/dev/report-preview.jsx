// Isolated development fixture: no authentication, provider or database requests.
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/manrope'
import '../index.css'
import '../redesign.css'
import ReportContent from '../components/Analytics/ReportContent'
import { buildFinancialReport } from '../lib/financialReport'
const rows = Array.from({ length: 65 }, (_, i) => ({ id: String(i), amount: i === 0 ? '2860097.00' : '15000.00', transaction_type: i === 0 ? 'income' : 'expense', analytics_bucket: i === 0 ? 'income' : 'expense', occurred_at: '2026-09-23T00:00:00Z', merchant: i === 0 ? 'Gaji September' : 'Kopi dan jajan', category_name: i === 0 ? 'Gaji' : i % 5 === 0 ? 'Lainnya' : 'Makan', category_type: i === 0 ? 'income' : 'expense', wallet_name: 'Tunai' }))
const request = async ({ body }) => buildFinancialReport(rows, body.month)
if (new URLSearchParams(location.search).has('dark')) document.documentElement.dataset.theme = 'dark'
createRoot(document.getElementById('root')).render(<ReportContent ownerId="demo" request={request} />)
