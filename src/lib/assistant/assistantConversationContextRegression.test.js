import { describe, expect, it } from 'vitest'
import { runAssistantEngine } from './assistantEngine'

const wallets = [{
  id: 'wallet-bibit',
  name: 'Tabungan Bibit',
  current_balance: 1_000_000,
}]

const goals = [{
  id: 'goal-nikah',
  name: 'Simpanan Nikah',
  current_amount: 0,
  target_amount: 70_000_000,
  status: 'active',
}]

function run(text, overrides = {}) {
  return runAssistantEngine({
    text,
    userId: 'context-regression-user',
    wallets,
    goals,
    now: new Date('2026-08-01T13:23:00+07:00'),
    ...overrides,
  })
}

describe('assistant conversation context regression', () => {
  it('does not reverse a wallet-to-goal transfer when the wallet name contains tabungan', () => {
    const result = run(
      'transfer semua dompet dari tabungan bibit ke simpanan nikah'
    )

    expect(result.route.intent).toBe('deposit_goal')
    expect(result.slots).toMatchObject({
      complete: true,
      slots: {
        amount: 1_000_000,
        sourceWallet: { id: 'wallet-bibit' },
        goal: { id: 'goal-nikah' },
      },
    })
    expect(result.dialogue.status).toBe('pending_confirmation')
  })

  it('continues a missing amount from dialogue state restored from the backend', () => {
    const first = run(
      'transfer dari tabungan bibit ke simpanan nikah'
    )
    expect(first.route.intent).toBe('deposit_goal')
    expect(first.slots.missingSlots).toEqual(['amount'])
    expect(first.dialogue.status).toBe('clarification')
    expect(first.response.text).not.toContain('Rp 0')
    expect(first.response.text).toContain('dari Tabungan Bibit ke target Simpanan Nikah')

    const restoredDialogueState = JSON.parse(JSON.stringify(first.dialogueState))
    const second = run('1jt', {
      dialogueState: restoredDialogueState,
    })

    expect(second.route.intent).toBe('deposit_goal')
    expect(second.slots).toMatchObject({
      complete: true,
      slots: {
        amount: 1_000_000,
        sourceWallet: { id: 'wallet-bibit' },
        goal: { id: 'goal-nikah' },
      },
    })
    expect(second.dialogue.status).toBe('pending_confirmation')
  })
})
