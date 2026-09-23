// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useWalletAdjustments } from './useWalletAdjustments'
const io = vi.hoisted(() => ({ user: { id: 'owner' }, from: vi.fn(), rpc: vi.fn() }))
vi.mock('../lib/neon', () => ({ neon: io }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: io.user }) }))
afterEach(cleanup)
it('reads owner/wallet-scoped adjustments, handles zero, retry, and masks previous account', async () => {
  const filters = []
  let failure = true
  io.from.mockImplementation(table => {
    expect(table).toBe('wallet_balance_adjustments')
    const q = { select: () => q, eq: (key, value) => { filters.push([key, value]); return q }, order: () => q, limit: () => q,
      then: resolve => Promise.resolve(failure ? { error: new Error('offline') } : { data: [{ id: 'a', previous_balance: '100', target_balance: '0', created_at: '2026-09-23T00:00:00Z' }] }).then(resolve) }
    return q
  })
  const { result, rerender } = renderHook(() => useWalletAdjustments('wallet'))
  await waitFor(() => expect(result.current.status).toBe('error'))
  failure = false
  await act(() => result.current.retry())
  expect(result.current.items[0].difference).toBe(-100)
  expect(result.current.hasMore).toBe(false)
  expect(filters).toContainEqual(['user_id', 'owner'])
  expect(filters).toContainEqual(['wallet_id', 'wallet'])
  expect(io.rpc).not.toHaveBeenCalled()
  io.user = { id: 'new-owner' }
  rerender()
  expect(result.current.items).toEqual([])
})
