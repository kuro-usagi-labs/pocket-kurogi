import { describe, expect, it } from 'vitest'
import { validateAssistantInterpretation, validatePendingActionExecution } from './safetyValidator'

const action = {
  userId: 'owner', actionType: 'set_wallet_balance', status: 'confirmed',
  expiresAt: '2099-01-01', idempotencyKey: 'request',
  payload: { walletId: 'wallet', expectedBalance: 50000, targetBalance: 400000 },
}

describe('wallet balance safety', () => {
  it('accepts exact two-decimal balances without floating-point multiplication errors', () => {
    expect(validatePendingActionExecution({ action: { ...action, payload: { ...action.payload, expectedBalance: 1234567.89, targetBalance: 1234567.89 } }, userId: 'owner', wallets: [{ id: 'wallet' }] }).safe).toBe(true)
  })
  it('rejects an income draft referencing an expense-only category', () => {
    const result = validatePendingActionExecution({ action: { ...action, actionType: 'record_transactions', payload: { items: [{ transactionType: 'income', amount: 50000, categoryId: 'jajan' }] } }, userId: 'owner', categories: [{ id: 'jajan', category_type: 'expense' }] })
    expect(result.safe).toBe(false)
    expect(result.errors.some(issue => issue.code === 'CATEGORY_TYPE_MISMATCH')).toBe(true)
  })
  it.each([-1, NaN, Infinity, 10000000000000, null, undefined, '', 'oops', 1.001])('rejects invalid final balance %s', targetBalance => {
    const result = validatePendingActionExecution({ action: { ...action, payload: { ...action.payload, targetBalance } }, userId: 'owner', wallets: [{ id: 'wallet' }] })
    expect(result.safe).toBe(false)
  })
  it('allows zero as a deliberate final balance', () => {
    expect(validatePendingActionExecution({ action: { ...action, payload: { ...action.payload, targetBalance: 0 } }, userId: 'owner', wallets: [{ id: 'wallet' }] }).safe).toBe(true)
  })
  it('requires an explicit finite expected balance for the concurrency check', () => {
    expect(validatePendingActionExecution({ action: { ...action, payload: { ...action.payload, expectedBalance: null } }, userId: 'owner', wallets: [{ id: 'wallet' }] }).safe).toBe(false)
  })
  it('does not choose silently between two wallets or balances', () => {
    const result = validateAssistantInterpretation({ intent: 'set_wallet_balance', entities: { wallets: [{ id: 'a' }, { id: 'b' }], amounts: [{ value: 20 }, { value: 40 }] }, slots: { targetBalance: 40, expectedBalance: 20 } })
    expect(result.safe).toBe(false)
  })
})
