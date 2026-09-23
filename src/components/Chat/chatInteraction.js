export async function submitChatDraft({ lock, clear, restore, send, getRevision = () => 0, onError }) {
  if (lock.current) return false
  lock.current = true
  const revision = getRevision()
  clear()
  try {
    const accepted = await send()
    if (accepted === false && getRevision() === revision) restore()
    return accepted !== false
  } catch (error) {
    if (getRevision() === revision) restore()
    onError?.(error)
    return false
  } finally {
    lock.current = false
  }
}

export function getChatScrollAction({ initialized, loading, loadingOlder, lastId, previousLastId, nearBottom, ownSend }) {
  if (loadingOlder) return 'preserve'
  if (loading) return 'none'
  if (!initialized && lastId) return 'initial'
  if (lastId !== previousLastId && (nearBottom || ownSend)) return 'latest'
  return 'none'
}

export function restoreHistoryPosition(container, snapshot) {
  if (snapshot.anchor?.isConnected) {
    container.scrollTop += snapshot.anchor.getBoundingClientRect().top - snapshot.anchorTop
    return
  }
  container.scrollTop = snapshot.top + container.scrollHeight - snapshot.height
}
