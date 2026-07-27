/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyThemePreference,
  getStoredThemePreference,
  resolveTheme,
  storeThemePreference,
} from '../lib/theme'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(getStoredThemePreference)
  const [systemTheme, setSystemTheme] = useState(() => resolveTheme('system'))
  const transitionTimerRef = useRef(null)
  const resolvedTheme = preference === 'system' ? systemTheme : preference

  useEffect(() => {
    applyThemePreference(preference)
  }, [preference, systemTheme])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = () => setSystemTheme(mediaQuery.matches ? 'dark' : 'light')
    mediaQuery.addEventListener('change', handleSystemThemeChange)

    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }, [])

  useEffect(() => () => window.clearTimeout(transitionTimerRef.current), [])

  const setThemePreference = useCallback((nextPreference) => {
    const root = document.documentElement
    root.classList.add('theme-transition')
    storeThemePreference(nextPreference)
    setPreference(nextPreference)

    window.clearTimeout(transitionTimerRef.current)
    transitionTimerRef.current = window.setTimeout(() => {
      root.classList.remove('theme-transition')
    }, 360)
  }, [])

  const value = useMemo(
    () => ({ preference, resolvedTheme, setThemePreference }),
    [preference, resolvedTheme, setThemePreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
