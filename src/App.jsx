import { useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './components/Auth/LoginPage'
import AppShell from './components/Layout/AppShell'
import AppErrorBoundary from './components/shared/AppErrorBoundary'
import { ThemeProvider } from './contexts/ThemeContext'

function AppContent() {
  const { user, loading } = useAuth()

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

  return user ? <AppShell /> : <LoginPage />
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
