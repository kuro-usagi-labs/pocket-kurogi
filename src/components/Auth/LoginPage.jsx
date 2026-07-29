import { useId, useState } from 'react'
import { ArrowLeft, ArrowRight, KeyRound, Mail, MessageCircleMore, PiggyBank } from 'lucide-react'
import { motion as Motion, useReducedMotion } from 'motion/react'
import { useAuth } from '../../contexts/AuthContext'
import {
  getInitialAuthNotice,
  isEmailVerificationError,
  toAuthMessage,
} from '../../lib/authMessages'
import KurogiLogo from '../shared/KurogiLogo'

export default function LoginPage() {
  const {
    signInWithPassword,
    signUp,
    requestPasswordReset,
    resendVerificationEmail,
    resetPassword,
  } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [verificationLoading, setVerificationLoading] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [mode, setMode] = useState(getInitialAuthMode)
  const [message, setMessage] = useState(getInitialAuthMessage)
  const [error, setError] = useState(getInitialAuthError)
  const passwordId = useId()
  const confirmPasswordId = useId()
  const reduceMotion = useReducedMotion()

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (loading) return

    setLoading(true)
    setError(null)
    setMessage(null)
    if (mode === 'login') setVerificationEmail('')

    try {
      const normalizedEmail = email.trim().toLowerCase()

      if (mode === 'reset') {
        const resetToken = new URLSearchParams(window.location.search).get('token')

        if (!resetToken) {
          setError('Link reset tidak valid atau sudah kedaluwarsa. Minta link baru.')
        } else if (password !== confirmPassword) {
          setError('Konfirmasi password belum sama.')
        } else {
          const result = await resetPassword(password, resetToken)
          if (result.error) {
            setError(toAuthMessage(result.error, mode))
          } else {
            window.history.replaceState({}, '', window.location.pathname)
            setPassword('')
            setConfirmPassword('')
            setMode('login')
            setMessage('Password baru sudah tersimpan. Silakan masuk kembali.')
          }
        }
      } else if (mode === 'forgot') {
        const result = await requestPasswordReset(normalizedEmail)
        if (result.error) setError(toAuthMessage(result.error, mode))
        else setMessage('Jika email terdaftar, link reset password akan segera dikirim. Periksa inbox dan folder spam.')
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('Konfirmasi password belum sama.')
        } else {
          const result = await signUp(normalizedEmail, password)
          if (result.error) {
            setError(toAuthMessage(result.error, mode))
          } else {
            setPassword('')
            setConfirmPassword('')
            setVerificationEmail(normalizedEmail)
            setMode('login')
            setMessage('Akun berhasil dibuat. Periksa email untuk verifikasi sebelum masuk.')
          }
        }
      } else {
        const result = await signInWithPassword(normalizedEmail, password)
        if (result.error) {
          if (isEmailVerificationError(result.error)) {
            setVerificationEmail(normalizedEmail)
          }
          setError(toAuthMessage(result.error, mode))
        }
      }
    } catch (caughtError) {
      setError(toAuthMessage(caughtError, mode))
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    const normalizedEmail = (verificationEmail || email).trim().toLowerCase()
    if (!normalizedEmail || verificationLoading) return

    setVerificationLoading(true)
    setError(null)
    setMessage(null)
    try {
      const result = await resendVerificationEmail(normalizedEmail)
      if (result.error) {
        setError(toVerificationMessage(result.error))
      } else {
        setVerificationEmail(normalizedEmail)
        setMessage('Email verifikasi baru sudah dikirim. Periksa inbox dan folder spam.')
      }
    } catch (caughtError) {
      setError(toVerificationMessage(caughtError))
    } finally {
      setVerificationLoading(false)
    }
  }

  const selectMode = (nextMode) => {
    if (mode === 'reset') {
      window.history.replaceState({}, '', window.location.pathname)
      setPassword('')
      setConfirmPassword('')
    }
    setMode(nextMode)
    setPassword('')
    setConfirmPassword('')
    setError(null)
    setMessage(null)
    setVerificationEmail('')
  }

  return (
    <main className="app-min-viewport paper-grid w-full overflow-y-auto bg-champagne px-4 py-4 font-inter sm:px-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100dvh-2rem)] w-full max-w-6xl overflow-hidden rounded-[20px] border border-midnight/8 bg-white shadow-[0_32px_100px_-48px_rgba(31,32,38,0.45)] lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[1.08fr_0.92fr]">
        <Motion.section
          initial={reduceMotion ? false : { opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex min-h-[270px] flex-col justify-between overflow-hidden bg-midnight p-6 text-white sm:min-h-[430px] sm:p-9 lg:min-h-0 lg:p-12"
        >
          <div className="relative flex items-center gap-3">
            <KurogiLogo size={50} />
            <div>
              <p className="font-jakarta text-[18px] font-bold tracking-[-0.04em]">Pocket Kurogi</p>
              <p className="text-[11px] font-medium text-white/55">Teman nabung lewat chat</p>
            </div>
          </div>

          <div className="relative mb-2 mt-8 max-w-xl sm:my-12 lg:my-16">
            <h1 className="max-w-[15ch] font-jakarta text-[35px] font-bold leading-[0.98] tracking-[-0.06em] sm:text-[50px]">
              Uang lebih mudah saat bisa dibicarakan.
            </h1>
            <p className="mt-4 max-w-[38ch] text-[13px] font-medium leading-relaxed text-white/62 sm:mt-5 sm:text-[15px]">
              Catat belanja, susun target, dan cek kemajuan dalam satu percakapan.
            </p>
          </div>

          <div className="relative hidden gap-3 sm:grid sm:grid-cols-2">
            <div className="rounded-[16px] bg-white/8 p-4">
              <MessageCircleMore size={20} className="text-orange-300" strokeWidth={2} />
              <p className="mt-3 text-[12px] font-bold">Tulis dengan bahasamu</p>
              <p className="mt-1 text-[11px] font-medium leading-relaxed text-white/55">“Sisihkan 50 ribu untuk liburan.”</p>
            </div>
            <div className="rounded-[16px] bg-white/8 p-4">
              <PiggyBank size={20} className="text-orange-300" strokeWidth={2} />
              <p className="mt-3 text-[12px] font-bold">Lihat tujuan bertumbuh</p>
              <p className="mt-1 text-[11px] font-medium leading-relaxed text-white/55">Setiap transaksi langsung terasa dampaknya.</p>
            </div>
          </div>
        </Motion.section>

        <Motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center p-5 sm:p-9 lg:p-12"
        >
          <form onSubmit={handleSubmit} className="mx-auto w-full max-w-[390px]">
            <div>
              <h2 className="font-jakarta text-[30px] font-bold tracking-[-0.05em] text-midnight">
                {getAuthHeading(mode)}
              </h2>
              <p className="mt-2 text-[13px] font-medium leading-relaxed text-muted">
                {getAuthDescription(mode)}
              </p>
            </div>

            {mode === 'login' || mode === 'register' ? (
            <div role="tablist" aria-label="Pilihan autentikasi" className="mt-5 grid grid-cols-2 gap-1 rounded-[16px] bg-champagne p-1 sm:mt-7">
              {[
                { id: 'login', label: 'Masuk' },
                { id: 'register', label: 'Daftar' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={mode === tab.id}
                  onClick={() => selectMode(tab.id)}
                  className={`rounded-[12px] py-2.5 text-[12px] font-bold transition-colors ${
                    mode === tab.id ? 'bg-white text-midnight shadow-sm' : 'text-muted hover:text-midnight'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            ) : null}

            <div className="mt-5 space-y-4 sm:mt-6">
              {mode !== 'reset' ? (
              <label className="block">
                <span className="mb-2 block text-[12px] font-bold text-midnight">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nama@email.com"
                  className="w-full rounded-[16px] border border-midnight/10 bg-champagne px-4 py-3.5 text-[16px] font-medium text-midnight outline-none transition-colors placeholder:text-muted/60 focus:border-orange-400 focus:bg-white"
                />
              </label>
              ) : null}

              {mode === 'login' || mode === 'register' || mode === 'reset' ? (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3 text-[12px] font-bold text-midnight">
                    <label htmlFor={passwordId}>{mode === 'reset' ? 'Password baru' : 'Password'}</label>
                    {mode === 'login' ? (
                      <button
                        type="button"
                        onClick={() => selectMode('forgot')}
                        className="text-orange-700 transition-colors hover:text-orange-600"
                      >
                        Lupa password?
                      </button>
                    ) : null}
                  </div>
                  <input
                    id={passwordId}
                    type="password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={mode === 'reset' ? 'Buat minimal 8 karakter' : 'Minimal 8 karakter'}
                    minLength={8}
                    autoComplete={mode === 'reset' ? 'new-password' : mode === 'register' ? 'new-password' : 'current-password'}
                    className="w-full rounded-[16px] border border-midnight/10 bg-champagne px-4 py-3.5 text-[16px] font-medium text-midnight outline-none transition-colors placeholder:text-muted/60 focus:border-orange-400 focus:bg-white"
                  />
                </div>
              ) : null}

              {mode === 'register' || mode === 'reset' ? (
                <div>
                  <label htmlFor={confirmPasswordId} className="mb-2 block text-[12px] font-bold text-midnight">
                    {mode === 'reset' ? 'Ulangi password baru' : 'Ulangi password'}
                  </label>
                  <input
                    id={confirmPasswordId}
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Ketik ulang password"
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full rounded-[16px] border border-midnight/10 bg-champagne px-4 py-3.5 text-[16px] font-medium text-midnight outline-none transition-colors placeholder:text-muted/60 focus:border-orange-400 focus:bg-white"
                  />
                </div>
              ) : null}
            </div>

            {error ? (
              <p role="alert" className="mt-4 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-700">{error}</p>
            ) : null}
            {message ? (
              <p role="status" className="mt-4 rounded-[16px] border border-orange-200 bg-orange-50 px-4 py-3 text-[12px] font-semibold text-orange-800">{message}</p>
            ) : null}
            {verificationEmail && mode === 'login' ? (
              <button
                type="button"
                disabled={verificationLoading}
                onClick={handleResendVerification}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2.5 text-[12px] font-bold text-orange-800 transition-colors hover:bg-orange-100 disabled:opacity-50"
              >
                <Mail size={16} />
                {verificationLoading ? 'Mengirim...' : 'Kirim ulang email verifikasi'}
              </button>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-orange-700 px-5 py-3.5 text-[14px] font-bold text-white shadow-[0_14px_32px_rgba(232,84,46,0.22)] transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              <span>{loading ? 'Memproses...' : getSubmitLabel(mode)}</span>
              {mode === 'forgot' ? <Mail size={18} /> : mode === 'reset' ? <KeyRound size={18} /> : <ArrowRight size={18} />}
            </button>

            {mode !== 'login' && mode !== 'register' ? (
              <button
                type="button"
                onClick={() => selectMode(mode === 'reset' ? 'forgot' : 'login')}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-[12px] font-bold text-muted transition-colors hover:text-midnight"
              >
                <ArrowLeft size={15} /> {mode === 'reset' ? 'Minta link baru' : 'Kembali ke login'}
              </button>
            ) : null}
          </form>
        </Motion.section>
      </div>
    </main>
  )
}

function getInitialAuthMode() {
  if (typeof window === 'undefined') return 'login'
  const params = new URLSearchParams(window.location.search)
  return params.has('token') || params.get('auth') === 'reset-password' ? 'reset' : 'login'
}

function getInitialAuthError() {
  if (typeof window === 'undefined') return null
  const errorCode = new URLSearchParams(window.location.search).get('error')
  return errorCode ? 'Link tidak valid atau sudah kedaluwarsa. Minta link baru.' : null
}

function getInitialAuthMessage() {
  if (typeof window === 'undefined') return null
  return getInitialAuthNotice(window.location.search)
}

function getAuthHeading(mode) {
  if (mode === 'register') return 'Mulai menabung'
  if (mode === 'forgot') return 'Pulihkan akses'
  if (mode === 'reset') return 'Buat password baru'
  return 'Lanjutkan obrolan'
}

function getAuthDescription(mode) {
  if (mode === 'register') return 'Buat ruang aman untuk catatan uangmu.'
  if (mode === 'forgot') return 'Masukkan email untuk menerima link reset password.'
  if (mode === 'reset') return 'Gunakan password yang kuat dan mudah kamu ingat.'
  return 'Data dan targetmu sudah menunggu.'
}

function getSubmitLabel(mode) {
  if (mode === 'register') return 'Buat akun'
  if (mode === 'forgot') return 'Kirim link reset'
  if (mode === 'reset') return 'Simpan password baru'
  return 'Masuk'
}

function toVerificationMessage(error) {
  const message = String(error?.message || '').toLowerCase()
  if (message.includes('already verified')) {
    return 'Email ini sudah terverifikasi. Silakan masuk.'
  }
  if (message.includes('rate') || message.includes('too many')) {
    return 'Terlalu banyak permintaan. Tunggu sebentar sebelum mengirim ulang.'
  }
  return 'Email verifikasi belum bisa dikirim. Tunggu sebentar lalu coba lagi.'
}
