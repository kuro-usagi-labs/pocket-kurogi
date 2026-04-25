import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './components/Auth/LoginPage'
import AppShell from './components/Layout/AppShell'

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-champagne">
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
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
