import { it, expect, vi } from 'vitest'
vi.mock('./useAssistantState', () => ({ useAssistantState: vi.fn() }))
import { processExistingPendingAction } from './useDeterministicAssistant'
import { runWalletAwareTurn } from '../lib/assistant/walletProvisionFlow'

it('confirms wallet creation, refreshes real wallet IDs and stages the exact salary without writing it early', async () => {
  const action = runWalletAwareTurn({ userId: 'user', text: 'catat pemasukan gaji Rp2860097 ke dompet BCA, jika dompet tidak ada tolong buatkan', wallets: [] }).pendingAction
  const state = {
    userId: 'user',
    confirmPendingAction: vi.fn().mockResolvedValue({ data: { ok: true } }),
    fetchFinancialContext: vi.fn().mockResolvedValue({ data: { wallets: [{ id: 'real-bca-id', name: 'BCA', current_balance: 0 }] } }),
    saveDialogueState: vi.fn().mockResolvedValue({ data: {} }),
    stagePendingAction: vi.fn().mockImplementation(async draft => ({ data: draft })),
  }
  const sync = vi.fn()
  const response = await processExistingPendingAction({ assistantState: state, engineResult: { command: { type: 'confirm_pending_action' } }, pendingAction: action, syncFinancialViews: sync, sourceMessageId: 'confirmation' })
  expect(state.confirmPendingAction).toHaveBeenCalledExactlyOnceWith(action)
  expect(sync).toHaveBeenCalledOnce()
  const transaction = state.stagePendingAction.mock.calls[0][0]
  expect(transaction.actionType).toBe('record_transactions')
  expect(transaction.payload.items[0]).toMatchObject({ amount: 2860097, description: 'Gaji', walletId: 'real-bca-id', transactionType: 'income' })
  expect(response.text).toContain('Dompet BCA berhasil dibuat')
  expect(response.card.type).toBe('pending_action')
  expect(state.saveDialogueState).toHaveBeenCalledTimes(2)
})
