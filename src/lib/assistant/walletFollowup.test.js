import { it, expect } from 'vitest'
import { runWalletAwareTurn, resumeWalletTransaction } from './walletProvisionFlow'
import { orchestrateAssistantMessage } from './unifiedAssistantOrchestrator'

const salary = 'aku baru mendapatkan gaji hari ini yaitu 2,860,097 tolong catat'
const wallets = [{ id: 'bca', name: 'BCA', current_balance: 0 }]
function run(text, extra = {}) {
  const input = { text, userId: 'test', wallets, ...extra }
  const orchestration = orchestrateAssistantMessage(input)
  return runWalletAwareTurn({ ...input, originalText: text, text: orchestration.resolvedText, semanticFrame: orchestration.frame })
}
it('continues salary with an existing BCA using the UI semantic frame', () => {
  const first = run(salary)
  const second = run('BCA', { dialogueState: JSON.parse(JSON.stringify(first.dialogueState)) })
  expect(second.pendingAction?.payload.items[0]).toMatchObject({ amount: 2860097, description: 'Gaji', walletId: 'bca' })
})
it('keeps the salary when BCA does not exist, then resumes with its real ID', () => {
  const first = run(salary, { wallets: [] })
  const second = run('BCA', { wallets: [], dialogueState: JSON.parse(JSON.stringify(first.dialogueState)) })
  expect(second.pendingAction?.actionType).toBe('create_wallet')
  expect(second.pendingAction?.payload).toMatchObject({ walletName: 'BCA', initialBalance: 0, resumeTransaction: { intent: 'record_income', slots: { amount: 2860097, description: 'Gaji' } } })
  const resumed = resumeWalletTransaction({ action: JSON.parse(JSON.stringify(second.pendingAction)), wallets, userId: 'test', sourceMessageId: 'confirmation' })
  expect(resumed.pendingAction?.payload.items[0]).toMatchObject({ amount: 2860097, description: 'Gaji', walletId: 'bca', transactionType: 'income' })
})
it.each([{ existing: [] }, { existing: wallets }])('understands the conditional wallet-creation request (%j)', ({ existing }) => {
  const result = run(`${salary}, masukkan ke dompet bca, jika dompet tidak ada tolong buatkan`, { wallets: existing })
  expect(result.safety.safe).toBe(true)
  expect(result.pendingAction?.actionType).toBe(existing.length ? 'record_transactions' : 'create_wallet')
  if (!existing.length) expect(result.pendingAction.payload.resumeTransaction.slots).toMatchObject({ amount: 2860097, description: 'Gaji' })
})
it('does not turn a negated salary into a wallet creation', () => {
  const result = run('jangan catat gaji 5jt ke dompet BCA, jika dompet tidak ada tolong buatkan', { wallets: [] })
  expect(result.pendingAction).toBeNull()
})
it('reparses against refreshed wallets rather than the stale UI frame', () => {
  const text = `${salary}, masukkan ke dompet bca, jika dompet tidak ada tolong buatkan`
  const stale = orchestrateAssistantMessage({ text, wallets: [] })
  const result = runWalletAwareTurn({ text, originalText: text, semanticFrame: stale.frame, userId: 'test', wallets })
  expect(result.pendingAction.actionType).toBe('record_transactions')
  expect(result.pendingAction.payload.items[0]).toMatchObject({ amount: 2860097, description: 'Gaji', walletId: 'bca' })
})
it('a fresh salary statement replaces the old incomplete amount', () => {
  const first = run(salary, { wallets: [] })
  const result = run('catat gaji Rp5000000 ke dompet BCA, jika dompet tidak ada tolong buatkan', { wallets: [], dialogueState: first.dialogueState })
  expect(result.pendingAction.payload.resumeTransaction.slots.amount).toBe(5000000)
})
