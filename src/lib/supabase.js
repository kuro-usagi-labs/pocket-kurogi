import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function createMemoryStorage() {
  const store = new Map()

  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
  }
}

function createSafeAuthStorage() {
  const memoryStorage = createMemoryStorage()

  if (typeof window === 'undefined' || !window.localStorage) {
    return memoryStorage
  }

  const storage = window.localStorage
  const testKey = 'pocket-kurogi-storage-check'

  try {
    storage.setItem(testKey, '1')
    storage.removeItem(testKey)
  } catch {
    return memoryStorage
  }

  return {
    getItem: (key) => {
      try {
        return storage.getItem(key)
      } catch {
        return memoryStorage.getItem(key)
      }
    },
    setItem: (key, value) => {
      memoryStorage.setItem(key, value)

      try {
        storage.setItem(key, value)
      } catch {
        // Keep the in-memory copy so Safari private mode can continue this tab session.
      }
    },
    removeItem: (key) => {
      memoryStorage.removeItem(key)

      try {
        storage.removeItem(key)
      } catch {
        // Local storage may become unavailable while Safari is running.
      }
    },
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
    storage: createSafeAuthStorage(),
    storageKey: 'pocket-kurogi-auth',
  },
})
