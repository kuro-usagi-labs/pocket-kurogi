export const CHAT_SYNC_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  DEGRADED: 'degraded',
  RETRYING: 'retrying',
  UNAVAILABLE: 'unavailable',
})

export function getChatFailureState({ hasSnapshot, retryAttempt }) {
  if (hasSnapshot) return CHAT_SYNC_STATUS.DEGRADED
  return retryAttempt > 0 ? CHAT_SYNC_STATUS.UNAVAILABLE : CHAT_SYNC_STATUS.DEGRADED
}

export function canShowFreshChat({ status, messageCount }) {
  return status === CHAT_SYNC_STATUS.READY && messageCount === 0
}

export function canRetryChat(status) {
  return [CHAT_SYNC_STATUS.DEGRADED, CHAT_SYNC_STATUS.UNAVAILABLE].includes(status)
}
