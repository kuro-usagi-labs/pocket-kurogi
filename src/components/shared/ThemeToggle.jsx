import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

export default function ThemeToggle() {
  const { resolvedTheme, setThemePreference } = useTheme()
  const dark = resolvedTheme === 'dark'
  return <button type="button" className="theme-toggle" onClick={() => setThemePreference(dark ? 'light' : 'dark')} aria-label={dark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'} title={dark ? 'Mode terang' : 'Mode gelap'}>{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
}
