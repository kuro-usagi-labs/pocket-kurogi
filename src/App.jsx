import { useEffect, useState } from 'react'
import LandingPage from './components/Landing/LandingPage'
import { getPublicPage } from './lib/publicNavigation'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './components/Auth/LoginPage'
import AppShell from './components/Layout/AppShell'
import AppErrorBoundary from './components/shared/AppErrorBoundary'
import { ThemeProvider } from './contexts/ThemeContext'

function AppContent() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState(() => getPublicPage(window.location.search))
  useEffect(() => {
    const update = () => setPage(getPublicPage(window.location.search))
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])
  const navigate = (next) => {
    window.history.pushState({}, '', next === 'home' ? '/' : `/?page=${next}`)
    setPage(next)
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.__KUROGI_APP_READY__ = true
    window.dispatchEvent(new Event('kurogi:ready'))
  }, [])

  if (loading) {
    return (
      <div className="app-viewport paper-grid flex w-full items-center justify-center bg-champagne">
        <div className="animate-fade-in flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-orange-700 shadow-[0_14px_30px_rgba(199,71,41,0.2)]">
            <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
          </div>
          <p className="font-jakarta text-[11px] font-bold text-muted">
            Menyiapkan ruangmu
          </p>
        </div>
      </div>
    )
  }

  if (user) return <AppShell />
  return page === 'home' ? <LandingPage onLogin={navigate} /> : <LoginPage key={page} initialMode={page} onBack={() => navigate('home')} />
}

export default function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  )
}
