import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './components/Auth/LoginPage'
import AppShell from './components/Layout/AppShell'

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-champagne">
        <div className="animate-fade-in flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-midnight flex items-center justify-center shadow-xl shadow-midnight/30">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          </div>
          <p className="text-muted/40 text-[10px] font-extrabold tracking-[0.2em] uppercase font-jakarta">
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
