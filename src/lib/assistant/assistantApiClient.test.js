import { afterEach, expect, it, vi } from 'vitest'
vi.mock('../neon', () => ({ neon: { auth: {} } }))
vi.mock('./assistantAuthToken', () => ({ getAssistantJwt: vi.fn().mockResolvedValue('test-token') }))
import { requestAssistantApi } from './assistantApiClient'

afterEach(() => vi.unstubAllGlobals())

it('preserves server rejection status and message for execution reconciliation', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false, status: 422,
    json: async () => ({ error: { message: 'Kategori transaksi tidak ditemukan.' } }),
  }))
  await expect(requestAssistantApi({ operation: 'confirm_action' })).rejects.toMatchObject({
    status: 422, message: 'Kategori transaksi tidak ditemukan.',
  })
})
