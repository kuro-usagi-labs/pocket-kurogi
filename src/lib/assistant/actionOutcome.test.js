import { expect, it, vi } from 'vitest'
import { classifyActionOutcome, confirmWithReconciliation } from './actionOutcome'
it('keeps an uncertain first execution unknown even if reconciliation is rejected', async () => {
  const request = vi.fn().mockRejectedValueOnce(new Error('timeout'))
    .mockRejectedValueOnce(Object.assign(new Error('expired'), { status: 409 }))
  const result = await confirmWithReconciliation({ action: { id: 'a', payloadHash: 'hash' }, request })
  expect(result.outcome).toBe('unknown')
  expect(request).toHaveBeenCalledTimes(2)
})
it('preserves a definitive server rejection without retrying it', async () => {
  const error = Object.assign(new Error('Kategori transaksi tidak ditemukan.'), { status: 422 })
  const request = vi.fn().mockRejectedValue(error)
  const result = await confirmWithReconciliation({ action: { id: 'a', payloadHash: 'hash' }, request })
  expect(result.outcome).toBe('failed')
  expect(result.error).toBe(error)
  expect(request).toHaveBeenCalledOnce()
})
it('does not confuse failed message delivery with confirmed money movement', () => {
  expect(classifyActionOutcome({ confirmedResult: { action_id: 'a' }, error: new Error('reply save failed'), requestSent: true })).toBe('confirmed')
  expect(classifyActionOutcome({ error: new Error('timeout'), requestSent: true })).toBe('unknown')
  expect(classifyActionOutcome({ error: new Error('invalid'), requestSent: false })).toBe('failed')
})
it('replays the same action/hash after a lost response without staging another action', async () => {
  const requests = []
  const request = async args => { requests.push(args); if (requests.length === 1) throw new Error('timeout'); return { action_id: 'a', replayed: true } }
  const result = await confirmWithReconciliation({ action: { id: 'a', payloadHash: 'hash' }, request })
  expect(result.data).toEqual({ action_id: 'a', replayed: true })
  expect(requests.map(r => [r.operation, r.body])).toEqual([
    ['confirm_action', { actionId: 'a', payloadHash: 'hash' }], ['confirm_action', { actionId: 'a', payloadHash: 'hash' }],
  ])
})
it('reports unknown after bounded retry, preserving the action for later reconciliation', async () => {
  const request = vi.fn().mockRejectedValue(new Error('timeout'))
  const result = await confirmWithReconciliation({ action: { id: 'a', payloadHash: 'hash' }, request })
  expect(result.outcome).toBe('unknown')
  expect(request).toHaveBeenCalledTimes(2)
})
