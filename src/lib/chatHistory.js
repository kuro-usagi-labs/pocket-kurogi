function getTimestamp(message) {
  const timestamp = Date.parse(message?.createdAt || message?.created_at || '')
  return Number.isFinite(timestamp) ? timestamp : 0
}

/**
 * Keep a single, chronological copy of every known chat message. A database
 * response may finish after a just-saved message, so replacing the UI state
 * with that response would make recent messages appear to vanish.
 */
export function mergeChatMessages(...lists) {
  const byId = new Map()

  for (const list of lists) {
    for (const message of list || []) {
      if (!message?.id) continue
      byId.set(message.id, message)
    }
  }

  return [...byId.values()].sort((left, right) => {
    const timeDelta = getTimestamp(left) - getTimestamp(right)
    if (timeDelta !== 0) return timeDelta
    return String(left.id).localeCompare(String(right.id))
  })
}
