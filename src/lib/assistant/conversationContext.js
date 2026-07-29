const DEFAULT_TTL_MS = 30 * 60 * 1000

export function createDialogueState({
  activeIntent = null,
  collectedSlots = {},
  missingSlots = [],
  pendingActionId = null,
  lastReferencedTransactionId = null,
  lastAssistantQuestion = null,
  now = new Date(),
  ttlMs = DEFAULT_TTL_MS,
} = {}) {
  const createdAt = new Date(now)
  return {
    version: 1,
    activeIntent,
    collectedSlots: { ...collectedSlots },
    missingSlots: [...new Set(missingSlots)],
    pendingActionId,
    lastReferencedTransactionId,
    lastAssistantQuestion,
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + ttlMs).toISOString(),
  }
}

export function updateDialogueState(state, patch = {}, now = new Date()) {
  const current = isDialogueStateActive(state, now)
    ? state
    : createDialogueState({ now })
  const collectedSlots = patch.collectedSlots
    ? { ...current.collectedSlots, ...patch.collectedSlots }
    : current.collectedSlots

  return {
    ...current,
    ...patch,
    collectedSlots,
    missingSlots: patch.missingSlots
      ? [...new Set(patch.missingSlots)]
      : current.missingSlots,
    updatedAt: new Date(now).toISOString(),
  }
}

export function clearDialogueState(now = new Date()) {
  return createDialogueState({ now, ttlMs: 0 })
}

export function isDialogueStateActive(state, now = new Date()) {
  if (!state || typeof state !== 'object') return false
  const expiresAt = new Date(state.expiresAt || 0).getTime()
  return Number.isFinite(expiresAt) && expiresAt > new Date(now).getTime()
}

export function collectConversationContext(messages = [], now = new Date()) {
  const ordered = [...messages]
    .filter((message) => message?.metadata?.dialogueState)
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))

  const state = ordered[0]?.metadata?.dialogueState || null
  return isDialogueStateActive(state, now) ? state : createDialogueState({ now })
}
