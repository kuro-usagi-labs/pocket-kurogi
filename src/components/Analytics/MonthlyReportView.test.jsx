// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MonthlyReportView from './MonthlyReportView'
import { requestAssistantApi } from '../../lib/assistant/assistantApiClient'
import { buildFinancialReport } from '../../lib/financialReport'
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }))
vi.mock('../../lib/assistant/assistantApiClient', () => ({ requestAssistantApi: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })
it('does not show invented zeros or permit export on failure', async () => {
  requestAssistantApi.mockRejectedValue(new Error('Offline'))
  render(<MonthlyReportView />)
  await screen.findByText('Laporan belum dapat dimuat')
  expect(screen.getByText('Unduh PDF').disabled).toBe(true)
  expect(screen.queryByText('Rp 0,00')).toBeNull()
})
it('loads the selected month and disables stale exports during period changes', async () => {
  requestAssistantApi.mockImplementation(async ({ body }) => buildFinancialReport([], body.month))
  render(<MonthlyReportView />)
  await screen.findByText('Kesimpulan periode ini')
  let resolve
  requestAssistantApi.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  fireEvent.change(screen.getByLabelText('Bulan laporan'), { target: { value: '2026-08' } })
  expect(screen.getByText('Unduh PDF').disabled).toBe(true)
  expect(screen.queryByText('Kesimpulan periode ini')).toBeNull()
  resolve(buildFinancialReport([], '2026-08'))
  await waitFor(() => expect(screen.getByText('Unduh PDF').disabled).toBe(false))
  expect(requestAssistantApi.mock.calls.at(-1)[0].body.month).toBe('2026-08')
})
