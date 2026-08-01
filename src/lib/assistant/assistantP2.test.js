import { describe, expect, it } from 'vitest'
import { runAssistantEngine } from './assistantEngine'
import { buildAssistantSemanticFrame } from './semanticFrame'

const now = new Date('2026-08-01T05:00:00.000Z')
const wallets = [
  { id: 'wallet-bca', name: 'BCA', wallet_type: 'bank', current_balance: 2_000_000 },
  { id: 'wallet-cash', name: 'Tunai', wallet_type: 'cash', current_balance: 200_000 },
]

function run(text, overrides = {}) {
  const options = {
    text,
    userId: 'user-p2',
    sourceMessageId: `p2-${text}`,
    wallets,
    now,
    ...overrides,
  }
  const semanticFrame = buildAssistantSemanticFrame(options)
  return { semanticFrame, result: runAssistantEngine({ ...options, semanticFrame }) }
}

describe('assistant P2 Indonesian specialist candidates', () => {
  it('separates purchase prices from tendered cash and change', () => {
    const { semanticFrame, result } = run(
      'tadi beli bensin dan makanan pakai uang 50rb, bensin 20rb, makanan 10rb dari Tunai, tolong catat'
    )

    expect(result.route.intent).toBe('record_multiple_transactions')
    expect(result.pendingAction.payload.items).toEqual([
      expect.objectContaining({ amount: 20_000, description: 'Bensin' }),
      expect.objectContaining({ amount: 10_000, description: 'Makanan' }),
    ])
    expect(result.pendingAction.payload.items).toHaveLength(2)
    expect(semanticFrame.entities.candidates).toContainEqual(
      expect.objectContaining({ kind: 'compound_purchase', source: 'utterance' })
    )
  })

  it('understands a clearly incoming third-party transfer as user income', () => {
    const { result } = run('ibu transfer 300rb ke aku, catat masuk ke BCA')

    expect(result.route.intent).toBe('record_income')
    expect(result.pendingAction.payload.items[0]).toMatchObject({
      amount: 300_000,
      transactionType: 'income',
      description: 'Transfer dari Ibu',
      walletId: 'wallet-bca',
    })
  })

  it('keeps a low-balance scenario separate from the account balance', () => {
    const { semanticFrame, result } = run('uangku tinggal 200rb buat sebulan, cukup tidak?')

    expect(result.route.intent).toBe('financial_advice')
    expect(result.slots.slots).toMatchObject({ scenarioBalance: 200_000, horizonDays: 30 })
    expect(result.insight.text).toMatch(/Jika memakai skenario Rp\s?200\.000/iu)
    expect(result.insight.details).toContain('Angka skenario dari pesanmu tidak mengubah saldo akun.')
    expect(result.insight.details.join(' ')).toMatch(/Rp\s?2\.200\.000/iu)
    expect(semanticFrame.provenance.extracted).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'scenario_balance' })])
    )
  })

  it('distinguishes a goal target from its opening deposit', () => {
    const { result } = run('buat target Laptop 10jt, setoran awal 500rb dari BCA')

    expect(result.route.intent).toBe('create_saving_goal')
    expect(result.pendingAction.payload).toMatchObject({
      amount: 10_000_000,
      initialAmount: 500_000,
      sourceWalletId: 'wallet-bca',
    })
    expect(result.pendingAction.payload.description).toMatch(/Laptop/iu)
  })

  it('preserves the regular change calculation path', () => {
    const { result } = run('tadi bayar 50rb kembali 36rb')
    expect(result.dialogue).toMatchObject({
      status: 'calculation',
      calculation: { spentAmount: 14_000 },
    })
  })

  it.each(['catat yang tadi', 'iya catat transaksi tadi'])(
    'accepts a short contextual confirmation: %s',
    (confirmation) => {
      const draft = run('beli kopi 20rb dari BCA, catat').result
      const confirmed = run(confirmation, {
        pendingAction: draft.pendingAction,
        dialogueState: draft.dialogueState,
      }).result

      expect(confirmed.route.intent).toBe('confirm_pending_action')
      expect(confirmed.command).toMatchObject({
        type: 'confirm_pending_action',
        pendingActionId: draft.pendingAction.id,
      })
    }
  )

  it('understands a direct nominal correction like "jadi 25rb"', () => {
    const draft = run('beli kopi 20rb dari BCA, catat').result
    const corrected = run('jadi 25rb', {
      pendingAction: draft.pendingAction,
      dialogueState: draft.dialogueState,
    }).result

    expect(corrected.route.intent).toBe('correct_pending_action')
    expect(corrected.command?.payload?.items?.[0]?.amount).toBe(25_000)
  })
})
