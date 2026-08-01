const DEFAULT_TTL_MS = 30 * 60 * 1000

export function createDialogueState({
  conversationId = null,
  activeIntent = null,
  activeFrame = null,
  collectedSlots = {},
  missingSlots = [],
  pendingActionId = null,
  lastReferencedTransactionId = null,
  referencedTransactionIds = [],
  lastResolvedIntent = activeIntent,
  lastAssistantQuestion = null,
  now = new Date(),
  ttlMs = DEFAULT_TTL_MS,
} = {}) {
  const createdAt = new Date(now)
  const references = [...new Set([
    ...referencedTransactionIds,
    ...(lastReferencedTransactionId ? [lastReferencedTransactionId] : []),
  ])]
  return {
    version: 2,
    conversationId: conversationId || createConversationId(createdAt),
    activeFrame: activeFrame || (activeIntent
      ? { intent: activeIntent, slots: { ...collectedSlots } }
      : null),
    activeIntent,
    collectedSlots: { ...collectedSlots },
    missingSlots: [...new Set(missingSlots)],
    pendingActionId,
    lastReferencedTransactionId,
    referencedTransactionIds: references,
    lastResolvedIntent,
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
  const activeIntent = patch.activeIntent !== undefined
    ? patch.activeIntent
    : current.activeIntent
  const referencedTransactionIds = [...new Set([
    ...(patch.referencedTransactionIds || current.referencedTransactionIds || []),
    ...(patch.lastReferencedTransactionId
      ? [patch.lastReferencedTransactionId]
      : []),
  ])]

  return {
    ...current,
    ...patch,
    version: 2,
    activeIntent,
    collectedSlots,
    activeFrame: patch.activeFrame !== undefined
      ? patch.activeFrame
      : activeIntent
        ? { intent: activeIntent, slots: { ...collectedSlots } }
        : null,
    missingSlots: patch.missingSlots
      ? [...new Set(patch.missingSlots)]
      : current.missingSlots,
    referencedTransactionIds,
    lastResolvedIntent: patch.lastResolvedIntent !== undefined
      ? patch.lastResolvedIntent
      : activeIntent || current.lastResolvedIntent || null,
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

function createConversationId(now) {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `conversation-${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`
}
