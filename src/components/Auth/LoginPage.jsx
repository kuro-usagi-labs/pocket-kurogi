import { useState } from 'react'
import { ArrowRight, Mail } from 'lucide-react'
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (mode === 'magic') {
      const { error } = await signInWithMagicLink(email)
      if (error) setError(error.message)
      else setMessage('Link masuk sudah dikirim.')
    } else if (mode === 'register') {
      const { error } = await signUp(email, password)
      if (error) setError(error.message)
      else setMessage('Akun dibuat. Cek email untuk konfirmasi.')
    } else {
      const { error } = await signInWithPassword(email, password)
      if (error) setError(error.message)
    }

    setLoading(false)
  }

  return (
    <div className="app-min-viewport flex w-full items-center justify-center bg-white px-5 py-5 font-inter sm:py-8">
      <div className="grid w-full max-w-5xl animate-fade-in gap-5 sm:gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <div className="max-w-xl">
          <KurogiLogo size={74} className="mb-4 shadow-sm sm:h-[86px] sm:w-[86px]" />
          <h1 className="font-jakarta text-[36px] font-extrabold leading-tight tracking-tight text-midnight sm:text-[56px]">
            Pocket Kurogi
          </h1>
          <p className="mt-3 text-[17px] font-medium leading-relaxed text-muted sm:mt-4 sm:text-[20px]">
            Asisten keuangan yang bantu catat transaksi, rapikan dompet, dan baca arus kas lewat chat.
          </p>
          <div className="mt-8 hidden grid-cols-3 gap-3 sm:grid">
            {['Chat', 'Histori', 'Dompet'].map((item) => (
              <div key={item} className="rounded-[18px] border border-midnight/10 bg-white px-5 py-4 shadow-sm">
                <p className="font-jakarta text-[15px] font-bold text-midnight">{item}</p>
                <p className="mt-1 text-[13px] font-medium text-muted">Rapi</p>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-[24px] border border-midnight/10 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.10)] sm:p-6">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-[18px] bg-champagne p-1.5 sm:mb-6">
            {[
              { id: 'login', label: 'Masuk' },
              { id: 'register', label: 'Daftar' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setMode(tab.id); setError(null); setMessage(null) }}
                className={`rounded-[14px] py-3 font-jakarta text-[12px] font-extrabold uppercase tracking-[0.12em] transition-all sm:py-3.5 sm:text-[13px] ${
                  mode === tab.id
                    ? 'bg-midnight text-white shadow-sm'
                    : 'text-muted hover:text-midnight'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <label className="mb-2 block font-jakarta text-[12px] font-extrabold uppercase tracking-[0.14em] text-muted">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
            className="mb-4 w-full rounded-[16px] border border-midnight/10 bg-champagne px-4 py-3.5 text-[16px] font-medium text-midnight outline-none transition-all placeholder:text-muted/50 focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100 sm:py-4"
          />

          {mode !== 'magic' && (
            <>
              <label className="mb-2 block font-jakarta text-[12px] font-extrabold uppercase tracking-[0.14em] text-muted">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                minLength={6}
                className="w-full rounded-[16px] border border-midnight/10 bg-champagne px-4 py-3.5 text-[16px] font-medium text-midnight outline-none transition-all placeholder:text-muted/50 focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100 sm:py-4"
              />
            </>
          )}

          {error && (
            <p className="mt-3 rounded-[16px] border border-red-100 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-600">
              {error}
            </p>
          )}
          {message && (
            <p className="mt-3 rounded-[16px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-700">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-[16px] bg-emerald-500 py-3.5 font-jakarta text-[15px] font-extrabold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 active:scale-[0.98] disabled:opacity-50 sm:mt-5 sm:py-4"
          >
            <span>{loading
              ? 'Memproses...'
              : mode === 'register'
                ? 'Buat akun'
                : mode === 'magic'
                  ? 'Kirim link'
                  : 'Masuk'}</span>
            {mode === 'magic' ? <Mail size={19} /> : <ArrowRight size={19} />}
          </button>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'magic' ? 'login' : 'magic')
                setError(null)
                setMessage(null)
              }}
              className="font-jakarta text-[13px] font-extrabold text-muted transition-colors hover:text-midnight"
            >
              {mode === 'magic' ? 'Pakai password' : 'Masuk via link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
