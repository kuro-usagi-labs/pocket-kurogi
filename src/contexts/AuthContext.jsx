/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import { neon } from '../lib/neon'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isActive = true

    const applySession = (currentSession) => {
      if (!isActive) {
        return
      }

      setSession(currentSession ?? null)
      setUser(currentSession?.user ?? null)
      setLoading(false)
    }

    const timeoutId = window.setTimeout(() => {
      console.warn('Auth bootstrap timed out. Continuing without cached session.')
      applySession(null)
    }, 2500)

    neon.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        window.clearTimeout(timeoutId)
        applySession(currentSession)
      })
      .catch((error) => {
        window.clearTimeout(timeoutId)
        console.warn('Auth bootstrap failed:', error)
        applySession(null)
      })

    const {
      data: { subscription },
    } = neon.auth.onAuthStateChange(async (_event, currentSession) => {
      window.clearTimeout(timeoutId)
      applySession(currentSession)
    })

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email, password) => {
    const { data, error } = await neon.auth.signUp({ email, password })
    return { data, error }
  }

  const signInWithPassword = async (email, password) => {
    const { data, error } = await neon.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signInWithMagicLink = async (email) => {
    const { error } = await neon.auth.signInWithOtp({ email })
    return { error }
  }

  const signOut = async () => {
    const { error } = await neon.auth.signOut()
    return { error }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        signInWithPassword,
        signInWithMagicLink,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
