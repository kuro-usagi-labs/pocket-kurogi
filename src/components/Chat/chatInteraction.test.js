import { describe, expect, it } from 'vitest'
import { submitChatDraft, getChatScrollAction, restoreHistoryPosition } from './chatInteraction'

describe('chat draft acceptance', () => {
  it('clears immediately and blocks a second send before the first settles', async () => {
    let resolve
    let draft = 'Lunch 25000'
    let sends = 0
    const lock = { current: false }
    const options = {
      lock,
      clear: () => { draft = '' },
      restore: () => { draft = 'Lunch 25000' },
      send: () => { sends++; return new Promise(done => { resolve = done }) },
    }
    const pending = submitChatDraft(options)
    expect(draft).toBe('')
    expect(await submitChatDraft(options)).toBe(false)
    expect(sends).toBe(1)
    resolve(true)
    await pending
    expect(lock.current).toBe(false)
  })

  it.each([false, 'throw'])('restores an unchanged draft on failed acceptance: %s', async result => {
    let draft = 'Lunch 25000'
    await submitChatDraft({
      lock: { current: false },
      clear: () => { draft = '' },
      restore: () => { draft = 'Lunch 25000' },
      send: async () => { if (result === 'throw') throw new Error('offline'); return result },
    })
    expect(draft).toBe('Lunch 25000')
  })

  it('does not replace a newer draft when an earlier submission is rejected', async () => {
    let resolve
    let draft = 'Lunch 25000'
    let revision = 0
    const pending = submitChatDraft({
      lock: { current: false },
      clear: () => { draft = '' },
      restore: () => { draft = 'Lunch 25000' },
      getRevision: () => revision,
      send: () => new Promise(done => { resolve = done }),
    })
    draft = 'Coffee 10000'
    revision++
    resolve(false)
    await pending
    expect(draft).toBe('Coffee 10000')
  })
})

describe('chat scroll intent', () => {
  const base = { initialized: true, previousLastId: '1', lastId: '2', nearBottom: true }
  it('opens existing and newly loaded history at latest', () => {
    expect(getChatScrollAction({ ...base, initialized: false, previousLastId: '2' })).toBe('initial')
    expect(getChatScrollAction({ ...base, initialized: false, loading: true })).toBe('none')
  })
  it('follows replies only while already near latest', () => {
    expect(getChatScrollAction(base)).toBe('latest')
    expect(getChatScrollAction({ ...base, nearBottom: false })).toBe('none')
  })
  it('follows own submission even when reading history', () => {
    expect(getChatScrollAction({ ...base, nearBottom: false, ownSend: true })).toBe('latest')
  })
  it('preserves pagination before considering new messages', () => {
    expect(getChatScrollAction({ ...base, loadingOlder: true })).toBe('preserve')
    const container = { scrollTop: 300, scrollHeight: 1500 }
    restoreHistoryPosition(container, { top: 300, height: 1000 })
    expect(container.scrollTop).toBe(800)
    container.scrollHeight = 1520
    restoreHistoryPosition(container, { top: 300, height: 1000 })
    expect(container.scrollTop).toBe(820)
  })
  it('keeps the visible message anchored when older and newer messages arrive together', () => {
    const container = { scrollTop: 300, scrollHeight: 1700 }
    restoreHistoryPosition(container, {
      top: 300, height: 1000, anchorTop: 20,
      anchor: { isConnected: true, getBoundingClientRect: () => ({ top: 520 }) },
    })
    expect(container.scrollTop).toBe(800)
  })
})
