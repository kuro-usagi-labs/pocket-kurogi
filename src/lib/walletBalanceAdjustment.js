export { formatMoney as formatWalletAdjustmentBalance } from './formatMoney'

export function isValidWalletBalance(value, allowNegative = false) {
  return typeof value === 'number' && Number.isFinite(value) &&
    (allowNegative || value >= 0) && Math.abs(value) <= 9999999999999.99 &&
    /^-?\d+(?:\.\d{1,2})?$/u.test(String(value))
}

export async function submitWalletBalanceAdjustment(rpc, { walletId, expectedBalance, targetBalance, idempotencyKey }) {
  if (!walletId || !idempotencyKey || !isValidWalletBalance(targetBalance) || !isValidWalletBalance(expectedBalance, true)) {
    return { data: null, error: new Error('Saldo harus berupa angka yang valid, maksimal dua angka desimal. Saldo akhir tidak boleh negatif.') }
  }
  try {
    return await rpc('set_wallet_balance_safely', {
      p_wallet_id: walletId, p_expected_balance: expectedBalance,
      p_target_balance: targetBalance, p_idempotency_key: idempotencyKey,
    })
  } catch (error) { return { data: null, error } }
}
