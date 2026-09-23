import { expect, it } from 'vitest'
import { formatWalletAdjustmentBalance, submitWalletBalanceAdjustment } from './walletBalanceAdjustment'

it('preserves cents in balance confirmation copy', () => {
  expect(formatWalletAdjustmentBalance(400000.01)).toContain('400.000,01')
  expect(formatWalletAdjustmentBalance(0)).toMatch(/Rp\s*0$/u)
})

it('sends final balance, expected balance and stable request identity instead of a delta', async () => {
  const rpc = async (name, payload) => {
    expect(name).toBe('set_wallet_balance_safely')
    expect(payload).toEqual({ p_wallet_id: 'wallet-1', p_expected_balance: 200, p_target_balance: 0, p_idempotency_key: 'request-1' })
    return { data: { current_balance: 0 }, error: null }
  }
  expect(await submitWalletBalanceAdjustment(rpc, { walletId: 'wallet-1', expectedBalance: 200, targetBalance: 0, idempotencyKey: 'request-1' })).toMatchObject({ data: { current_balance: 0 }, error: null })
})
it.each([-1, NaN, Infinity, null, '', true, 1.001, 10000000000000])('rejects invalid balance %s before writing', async (targetBalance) => {
  let calls = 0
  const result = await submitWalletBalanceAdjustment(async () => { calls++; return {} }, { walletId: 'wallet-1', expectedBalance: 200, targetBalance, idempotencyKey: 'request-1' })
  expect(result.error).toBeTruthy()
  expect(calls).toBe(0)
})
it.each([true, false, null, '', '200', NaN, Infinity, 1.001, -10000000000000])('rejects invalid expected balance %s', async (expectedBalance) => {
  let calls = 0
  const result = await submitWalletBalanceAdjustment(async () => { calls++; return {} }, { walletId: 'wallet-1', expectedBalance, targetBalance: 20, idempotencyKey: 'request-1' })
  expect(result.error).toBeTruthy()
  expect(calls).toBe(0)
})
it.each([0.29, 400000.01, 9999999999999.99])('accepts valid decimal balance %s', async (targetBalance) => {
  const result = await submitWalletBalanceAdjustment(async () => ({ data: { current_balance: targetBalance }, error: null }), { walletId: 'wallet-1', expectedBalance: -100, targetBalance, idempotencyKey: 'request-1' })
  expect(result.error).toBeNull()
})
