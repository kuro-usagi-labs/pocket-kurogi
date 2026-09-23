// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAssistantState } from './useAssistantState'

const io = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }))
vi.mock('../lib/assistant/assistantApiClient', () => ({ requestAssistantApi: io.request }))
afterEach(() => { cleanup(); vi.resetAllMocks() })

it.each(['failed', 'unknown', 'confirmed'])('preserves %s execution outcome through the hook', async outcome => {
  const rejection = Object.assign(new Error('Kategori transaksi tidak ditemukan.'), { status: 409 })
  io.request.mockImplementation(async ({ operation }) => {
    if (operation === 'get_state') return {}
    if (outcome === 'failed') throw rejection
    if (outcome === 'unknown') throw new Error('timeout')
    return { action_id: 'action-a' }
  })
  const { result } = renderHook(() => useAssistantState())
  await waitFor(() => expect(result.current.loading).toBe(false))
  let confirmation
  await act(async () => {
    confirmation = await result.current.confirmPendingAction({ id: 'action-a', payloadHash: 'hash' })
  })
  expect(confirmation.outcome).toBe(outcome)
  if (outcome === 'failed') expect(confirmation.error).toBe(rejection)
})
