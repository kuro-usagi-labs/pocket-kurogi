// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useTransactions } from './useTransactions'
import { useAnalytics } from './useAnalytics'

const io = vi.hoisted(() => ({ user: { id: 'a' }, rpc: vi.fn(), from: vi.fn(), history: vi.fn() }))
vi.mock('../lib/neon', () => ({ neon: io }))
vi.mock('../lib/assistant/assistantApiClient', () => ({ requestAssistantApi: (...args) => io.history(...args) }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: io.user }) }))
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const row = n => ({ id: `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`, created_at: '2026-09-23T00:00:00.000Z', occurred_at: '2026-09-23T00:00:00.000Z', transaction_type: 'income', amount: 1, source: 'chat' })
beforeEach(() => { io.user = { id: 'a' }; vi.resetAllMocks() })
afterEach(cleanup)

it('loads all 31 tied timestamps, then exhausts history without duplicates', async () => {
  const rows = Array.from({ length: 31 }, (_, i) => row(31 - i))
  io.history.mockImplementation(async ({ body }) => ({ transactions: rows.filter(r => !body.cursor || r.id < body.cursor.id).slice(0, 30) }))
  const { result } = renderHook(useTransactions)
  await waitFor(() => expect(result.current.transactions).toHaveLength(30))
  await act(() => result.current.loadMore())
  expect(result.current.transactions).toHaveLength(31)
  expect(result.current.transactions.at(-1).id).toBe('11111111-1111-4111-8111-000000000001')
  expect(result.current.hasMore).toBe(false)
  expect(io.history.mock.calls[1][0].body.cursor.id).toBe(rows[29].id)
})

it('masks totals as well as rows immediately when the account changes', async () => {
  io.history.mockResolvedValue({ transactions: [row(1)] })
  const { result, rerender } = renderHook(useTransactions)
  await waitFor(() => expect(result.current.totalIncome).toBe(1))
  io.user = { id: 'b' }
  rerender()
  expect(result.current.transactions).toEqual([])
  expect(result.current.totalIncome).toBe(0)
  expect(result.current.loading).toBe(true)
})

it('ignores an old load-more response after refresh and keeps rows on retryable failure', async () => {
  const page = deferred()
  io.history.mockResolvedValueOnce({ transactions: Array.from({ length: 30 }, (_, i) => row(31 - i)) })
    .mockReturnValueOnce(page.promise).mockResolvedValueOnce({ transactions: [row(99)] })
    .mockRejectedValueOnce(new Error('offline'))
  const { result } = renderHook(useTransactions)
  await waitFor(() => expect(result.current.transactions).toHaveLength(30))
  let oldPage
  act(() => { oldPage = result.current.loadMore() })
  await act(() => result.current.refetch())
  await act(async () => { page.resolve({ transactions: [row(1)] }); await oldPage })
  expect(result.current.transactions.map(r => r.id)).toEqual(['11111111-1111-4111-8111-000000000099'])
  await act(() => result.current.refetch())
  expect(result.current.transactions).toHaveLength(1)
  expect(result.current.error.message).toBe('offline')
})

it('shows invalid or failed backend reads as errors rather than zero transactions', async () => {
  io.history.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('Sesi kedaluwarsa'))
    .mockResolvedValueOnce({ transactions: [row(2)] })
  const { result } = renderHook(useTransactions)
  await waitFor(() => expect(result.current.error?.message).toMatch(/Respons riwayat/))
  expect(result.current.loading).toBe(false)
  await act(() => result.current.refetch())
  expect(result.current.error.message).toBe('Sesi kedaluwarsa')
  await act(() => result.current.refetch())
  expect(result.current.transactions).toHaveLength(1)
  expect(result.current.error).toBeNull()
})

it('keeps the last report on failure and ignores late responses after account switch', async () => {
  io.rpc.mockResolvedValueOnce({ data: { totalIncome: 100 } })
  const { result, rerender } = renderHook(useAnalytics)
  await waitFor(() => expect(result.current.status).toBe('success'))
  io.rpc.mockResolvedValueOnce({ error: new Error('offline') })
  await act(() => result.current.refetch())
  expect(result.current.status).toBe('stale')
  expect(result.current.analytics.totalIncome).toBe(100)
  const old = deferred()
  io.rpc.mockReturnValueOnce(old.promise)
  let pending
  act(() => { pending = result.current.refetch() })
  io.user = { id: 'b' }
  io.rpc.mockResolvedValueOnce({ data: { totalIncome: 200 } })
  rerender()
  expect(result.current.analytics.totalIncome).toBe(0)
  expect(result.current.status).toBe('loading')
  await waitFor(() => expect(result.current.analytics.totalIncome).toBe(200))
  await act(async () => { old.resolve({ data: { totalIncome: 999 } }); await pending })
  expect(result.current.analytics.totalIncome).toBe(200)
})
