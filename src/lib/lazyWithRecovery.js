import { lazy } from 'react'

const RECOVERY_WINDOW_MS = 15_000
const CHUNK_ERROR_PATTERN =
  /(?:failed to fetch dynamically imported module|error loading dynamically imported module|loading chunk \d+ failed|importing a module script failed)/iu

export function lazyWithRecovery(importer, key) {
  return lazy(() => importWithChunkRecovery(importer, { key }))
}

export async function importWithChunkRecovery(
  importer,
  {
    key = 'unknown',
    storage = getSessionStorage(),
    location = globalThis.location,
    now = Date.now(),
  } = {}
) {
  const recoveryKey = `pocket-kurogi:chunk-recovery:${key}`

  try {
    const importedModule = await importer()
    safelyRemove(storage, recoveryKey)
    return importedModule
  } catch (error) {
    if (!isRecoverableChunkError(error)) throw error

    const reloadScheduled = scheduleChunkRecovery({
      storage,
      location,
      recoveryKey,
      now,
    })
    if (!reloadScheduled) throw error

    // Navigation replaces this document. Keeping the promise pending prevents a
    // transient error screen while the fresh application bundle is loading.
    return new Promise(() => {})
  }
}

export function isRecoverableChunkError(error) {
  return CHUNK_ERROR_PATTERN.test(String(error?.message || error || ''))
}

export function scheduleChunkRecovery({
  storage,
  location,
  recoveryKey,
  now = Date.now(),
} = {}) {
  if (!location?.reload) return false

  const previousAttempt = Number(safelyRead(storage, recoveryKey) || 0)
  if (previousAttempt > 0 && now - previousAttempt < RECOVERY_WINDOW_MS) {
    safelyRemove(storage, recoveryKey)
    return false
  }

  safelyWrite(storage, recoveryKey, String(now))
  location.reload()
  return true
}

function getSessionStorage() {
  try {
    return globalThis.sessionStorage || null
  } catch {
    return null
  }
}

function safelyRead(storage, key) {
  try {
    return storage?.getItem(key) || null
  } catch {
    return null
  }
}

function safelyWrite(storage, key, value) {
  try {
    storage?.setItem(key, value)
  } catch {
    // Reload still works when storage is unavailable.
  }
}

function safelyRemove(storage, key) {
  try {
    storage?.removeItem(key)
  } catch {
    // A blocked storage API must not prevent the module from loading.
  }
}
