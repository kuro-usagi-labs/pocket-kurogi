import { describe, expect, it } from 'vitest'
import { CHAT_SYNC_STATUS, canRetryChat, canShowFreshChat, getChatFailureState } from './chatSyncState'

describe('chat sync state', () => {
  it('never treats a failed initial request as a fresh chat', () => {
    expect(getChatFailureState({ hasSnapshot: false, retryAttempt: 0 }))
      .toBe(CHAT_SYNC_STATUS.DEGRADED)
    expect(canShowFreshChat({ status: CHAT_SYNC_STATUS.DEGRADED, messageCount: 0 }))
      .toBe(false)
  })

  it('keeps a snapshot recoverable and allows a deliberate retry', () => {
    expect(getChatFailureState({ hasSnapshot: true, retryAttempt: 2 }))
      .toBe(CHAT_SYNC_STATUS.DEGRADED)
    expect(canRetryChat(CHAT_SYNC_STATUS.DEGRADED)).toBe(true)
  })

  it('only shows the opening after a successful empty response', () => {
    expect(canShowFreshChat({ status: CHAT_SYNC_STATUS.READY, messageCount: 0 })).toBe(true)
    expect(canShowFreshChat({ status: CHAT_SYNC_STATUS.READY, messageCount: 1 })).toBe(false)
  })
})
