/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react'
import { neon } from '../lib/neon'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const authSession = neon.auth.useSession()
  const user = authSession.data?.user ?? null
  const session = authSession.data?.session ?? null
  const loading = authSession.isPending

  const signUp = async (email, password) => {
    const { data, error } = await neon.auth.signUp.email({
      email,
      password,
      name: email.split('@')[0],
    })
    return { data, error }
  }

  const signInWithPassword = async (email, password) => {
    const { data, error } = await neon.auth.signIn.email({ email, password })
    return { data, error }
  }

  const requestPasswordReset = async (email) => {
    const resetUrl = new URL(window.location.origin)
    resetUrl.searchParams.set('auth', 'reset-password')

    const { data, error } = await neon.auth.requestPasswordReset({
      email,
      redirectTo: resetUrl.toString(),
    })
    return { data, error }
  }

  const resendVerificationEmail = async (email) => {
    const verificationUrl = new URL(window.location.origin)
    verificationUrl.searchParams.set('auth', 'email-verified')

    const { data, error } = await neon.auth.sendVerificationEmail({
      email,
      callbackURL: verificationUrl.toString(),
    })
    return { data, error }
  }

  const resetPassword = async (newPassword, token) => {
    const { data, error } = await neon.auth.resetPassword({
      newPassword,
      token,
    })
    return { data, error }
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
        requestPasswordReset,
        resendVerificationEmail,
        resetPassword,
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
