import { useState } from 'react'
import { ArrowRight, Mail, MessageCircleMore, PiggyBank } from 'lucide-react'
import { motion as Motion, useReducedMotion } from 'motion/react'
import { useAuth } from '../../contexts/AuthContext'
import KurogiLogo from '../shared/KurogiLogo'

export default function LoginPage() {
  const { signInWithPassword, signUp, signInWithMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const reduceMotion = useReducedMotion()

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (loading) return

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const normalizedEmail = email.trim().toLowerCase()

      if (mode === 'magic') {
        const result = await signInWithMagicLink(normalizedEmail)
        if (result.error) setError(toAuthMessage(result.error))
        else setMessage('Link masuk sudah dikirim. Periksa inbox dan folder spam.')
      } else if (mode === 'register') {
        const result = await signUp(normalizedEmail, password)
        if (result.error) setError(toAuthMessage(result.error))
        else setMessage('Akun berhasil dibuat. Jika belum masuk otomatis, periksa emailmu.')
      } else {
        const result = await signInWithPassword(normalizedEmail, password)
        if (result.error) setError(toAuthMessage(result.error))
      }
    } catch (caughtError) {
      setError(toAuthMessage(caughtError))
    } finally {
      setLoading(false)
    }
  }

  const selectMode = (nextMode) => {
    setMode(nextMode)
    setError(null)
    setMessage(null)
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
                {mode === 'register' ? 'Mulai menabung' : mode === 'magic' ? 'Masuk tanpa password' : 'Lanjutkan obrolan'}
              </h2>
              <p className="mt-2 text-[13px] font-medium leading-relaxed text-muted">
                {mode === 'register' ? 'Buat ruang aman untuk catatan uangmu.' : 'Data dan targetmu sudah menunggu.'}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-1 rounded-[16px] bg-champagne p-1 sm:mt-7">
              {[
                { id: 'login', label: 'Masuk' },
                { id: 'register', label: 'Daftar' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectMode(tab.id)}
                  className={`rounded-[12px] py-2.5 text-[12px] font-bold transition-colors ${
                    mode === tab.id ? 'bg-white text-midnight shadow-sm' : 'text-muted hover:text-midnight'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-4 sm:mt-6">
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

              {mode !== 'magic' ? (
                <label className="block">
                  <span className="mb-2 block text-[12px] font-bold text-midnight">Password</span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Minimal 8 karakter"
                    minLength={8}
                    className="w-full rounded-[16px] border border-midnight/10 bg-champagne px-4 py-3.5 text-[16px] font-medium text-midnight outline-none transition-colors placeholder:text-muted/60 focus:border-orange-400 focus:bg-white"
                  />
                </label>
              ) : null}
            </div>

            {error ? (
              <p className="mt-4 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-700">{error}</p>
            ) : null}
            {message ? (
              <p className="mt-4 rounded-[16px] border border-orange-200 bg-orange-50 px-4 py-3 text-[12px] font-semibold text-orange-800">{message}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-orange-700 px-5 py-3.5 text-[14px] font-bold text-white shadow-[0_14px_32px_rgba(232,84,46,0.22)] transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              <span>{loading ? 'Memproses...' : mode === 'register' ? 'Buat akun' : mode === 'magic' ? 'Kirim link' : 'Masuk'}</span>
              {mode === 'magic' ? <Mail size={18} /> : <ArrowRight size={18} />}
            </button>

            <button
              type="button"
              onClick={() => selectMode(mode === 'magic' ? 'login' : 'magic')}
              className="mt-4 w-full rounded-full px-4 py-2 text-[12px] font-bold text-muted transition-colors hover:text-midnight"
            >
              {mode === 'magic' ? 'Pakai password' : 'Masuk lewat link email'}
            </button>
          </form>
        </Motion.section>
      </div>
    </main>
  )
}

function toAuthMessage(error) {
  const message = String(error?.message || '').toLowerCase()
  const status = Number(error?.status || error?.statusCode || 0)

  if (
    status === 401 ||
    status === 403 ||
    message.includes('invalid') ||
    message.includes('password') ||
    message.includes('credential')
  ) {
    return 'Email atau password tidak cocok.'
  }

  if (message.includes('already') || message.includes('exist')) {
    return 'Email ini sudah terdaftar. Silakan masuk.'
  }

  if (message.includes('rate') || message.includes('too many')) {
    return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'
  }

  return 'Proses masuk belum berhasil. Periksa data lalu coba lagi.'
}
