import { useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './components/Auth/LoginPage'
import AppShell from './components/Layout/AppShell'
import AppErrorBoundary from './components/shared/AppErrorBoundary'

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
      <div className="app-viewport flex w-full items-center justify-center bg-champagne">
        <div className="animate-fade-in flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-midnight shadow-xl shadow-midnight/20">
            <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
          </div>
          <p className="font-jakarta text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
            Loading
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
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </AppErrorBoundary>
  )
}
