import { describe, expect, it, vi } from 'vitest'
import {
  importWithChunkRecovery,
  isRecoverableChunkError,
  scheduleChunkRecovery,
} from './lazyWithRecovery'

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  }
}

describe('lazy chunk recovery', () => {
  it('recognizes stale dynamic import errors across browsers', () => {
    expect(isRecoverableChunkError(
      new TypeError('Failed to fetch dynamically imported module: /assets/view-old.js')
    )).toBe(true)
    expect(isRecoverableChunkError(
      new Error('Importing a module script failed.')
    )).toBe(true)
    expect(isRecoverableChunkError(new Error('Network request failed'))).toBe(false)
  })

  it('reloads once and prevents a tight reload loop', () => {
    const storage = createMemoryStorage()
    const location = { reload: vi.fn() }
    const recoveryKey = 'pocket-kurogi:chunk-recovery:history'

    expect(scheduleChunkRecovery({
      storage,
      location,
      recoveryKey,
      now: 10_000,
    })).toBe(true)
    expect(location.reload).toHaveBeenCalledTimes(1)

    expect(scheduleChunkRecovery({
      storage,
      location,
      recoveryKey,
      now: 12_000,
    })).toBe(false)
    expect(location.reload).toHaveBeenCalledTimes(1)
  })

  it('clears an earlier recovery marker after a successful import', async () => {
    const recoveryKey = 'pocket-kurogi:chunk-recovery:wallets'
    const storage = createMemoryStorage({ [recoveryKey]: '10000' })
    const importedModule = { default: () => null }

    await expect(importWithChunkRecovery(
      async () => importedModule,
      {
        key: 'wallets',
        storage,
        location: { reload: vi.fn() },
      }
    )).resolves.toBe(importedModule)
    expect(storage.values.has(recoveryKey)).toBe(false)
  })
})
