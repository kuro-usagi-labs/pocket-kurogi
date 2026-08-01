import { describe, expect, it } from 'vitest'
import { runAssistantEngine } from './assistantEngine'

const now = new Date('2026-08-01T05:00:00.000Z')
const wallets = [
  { id: 'wallet-bca', name: 'BCA', wallet_type: 'bank', current_balance: 2_000_000 },
  { id: 'wallet-cash', name: 'Tunai', wallet_type: 'cash', current_balance: 200_000 },
]
const goals = [
  { id: 'goal-emergency', name: 'Dana Darurat', current_amount: 500_000, status: 'active' },
]

function run(text, overrides = {}) {
  return runAssistantEngine({
    text,
    userId: 'user-1',
    sourceMessageId: `message-${text}`,
    wallets,
    goals,
    now,
    ...overrides,
  })
}

describe('assistant P1 canonical capabilities', () => {
  it('stages wallet creation instead of mutating immediately', () => {
    const result = run('buatkan dompet GoPay saldo 100rb')

    expect(result.route.intent).toBe('create_wallet')
    expect(result.dialogue.status).toBe('pending_confirmation')
    expect(result.pendingAction).toMatchObject({
      actionType: 'create_wallet',
      payload: {
        walletName: 'GoPay',
        initialBalance: 100_000,
        walletType: 'e_wallet',
      },
      status: 'pending',
    })
  })

  it.each([
    [
      'ganti nama dompet BCA menjadi Rekening Utama',
      'rename_wallet',
      { walletId: 'wallet-bca', nextWalletName: 'Rekening Utama' },
    ],
    [
      'hapus dompet BCA',
      'archive_wallet',
      { walletId: 'wallet-bca' },
    ],
  ])('stages wallet command: %s', (text, intent, payload) => {
    const result = run(text)

    expect(result.route.intent).toBe(intent)
    expect(result.pendingAction).toMatchObject({
      actionType: intent,
      payload: expect.objectContaining(payload),
    })
  })

  it('resolves archived wallets only for restoration', () => {
    const result = run('pulihkan dompet Jago', {
      archivedWallets: [{ id: 'wallet-jago', name: 'Jago', is_archived: true }],
    })

    expect(result.route.intent).toBe('restore_wallet')
    expect(result.pendingAction).toMatchObject({
      actionType: 'restore_wallet',
      payload: { walletId: 'wallet-jago', walletName: 'Jago' },
    })
  })

  it.each([
    [
      'tabung 100rb dari BCA ke target Dana Darurat',
      'deposit_goal',
      { sourceWalletId: 'wallet-bca' },
    ],
    [
      'tarik 50rb dari target Dana Darurat ke Tunai',
      'withdraw_goal',
      { destinationWalletId: 'wallet-cash' },
    ],
  ])('stages goal movement: %s', (text, intent, payload) => {
    const result = run(text)

    expect(result.route.intent).toBe(intent)
    expect(result.pendingAction).toMatchObject({
      actionType: intent,
      payload: expect.objectContaining({
        goalId: 'goal-emergency',
        ...payload,
      }),
    })
  })

  it('carries a change calculation into a later expense draft', () => {
    const calculation = run('tadi bayar 50rb kembali 36rb')
    expect(calculation.dialogue).toMatchObject({
      status: 'calculation',
      calculation: { spentAmount: 14_000 },
    })

    const requestRecord = run('oke catat ke pengeluaran ya tadi', {
      dialogueState: calculation.dialogueState,
    })
    expect(requestRecord.route.intent).toBe('record_expense')
    expect(requestRecord.slots).toMatchObject({
      slots: { amount: 14_000, description: 'Belanja tadi' },
      missingSlots: ['wallet'],
    })

    const selectWallet = run('BCA', {
      dialogueState: requestRecord.dialogueState,
    })
    expect(selectWallet.pendingAction).toMatchObject({
      actionType: 'record_transactions',
      payload: {
        items: [expect.objectContaining({
          amount: 14_000,
          walletId: 'wallet-bca',
          description: 'Belanja tadi',
        })],
      },
    })
  })

  it('composes a natural canonical greeting', () => {
    const result = run('halo')

    expect(result.route.intent).toBe('general_chat')
    expect(result.response.text).toMatch(/siap|mulai/iu)
  })
})
