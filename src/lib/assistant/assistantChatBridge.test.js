import { describe, expect, it } from 'vitest'
import { shouldSupersedePendingAction } from './assistantChatBridge'

describe('shouldSupersedePendingAction', () => {
  it.each([
    'confirm_pending_action',
    'cancel_pending_action',
    'correct_pending_action',
  ])('keeps a pending action for %s', (command) => {
    expect(shouldSupersedePendingAction({ command: { type: command } })).toBe(false)
  })

  it('releases an old draft when the user starts a different conversation', () => {
    expect(shouldSupersedePendingAction({
      route: { intent: 'query_balance' },
      command: null,
    })).toBe(true)
  })
})
