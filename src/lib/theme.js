export const THEME_STORAGE_KEY = 'kurogi-theme'

const THEME_PREFERENCES = new Set(['system', 'light', 'dark'])

export function getStoredThemePreference() {
  if (typeof window === 'undefined') return 'system'

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    return THEME_PREFERENCES.has(storedTheme) ? storedTheme : 'system'
  } catch {
    return 'system'
  }
}

export function resolveTheme(preference) {
  if (preference === 'light' || preference === 'dark') return preference
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyThemePreference(preference) {
  if (typeof document === 'undefined') return 'light'

  const resolvedTheme = resolveTheme(preference)
  const root = document.documentElement
  const themeColor = document.querySelector('meta[name="theme-color"]')

  root.dataset.theme = resolvedTheme
  root.dataset.themePreference = preference
  root.style.colorScheme = resolvedTheme
  themeColor?.setAttribute('content', resolvedTheme === 'dark' ? '#111317' : '#f1f2f4')

  return resolvedTheme
}

export function storeThemePreference(preference) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // The active theme still works when storage is unavailable.
  }
}

export function initializeTheme() {
  return applyThemePreference(getStoredThemePreference())
}
