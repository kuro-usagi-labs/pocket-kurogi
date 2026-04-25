import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

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
    <div className="flex h-[100dvh] w-full items-center justify-center bg-champagne px-4 font-inter">
      <div className="w-full max-w-[388px] animate-fade-in">
        <div className="mb-7">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-midnight text-white shadow-premium">
            <Sparkles size={19} strokeWidth={2} />
          </div>
          <h1 className="font-jakarta text-[30px] font-extrabold tracking-tight text-midnight">
            Pocket Kurogi
          </h1>
          <p className="mt-2 text-[14px] font-semibold text-muted">
            Catatan keuangan via chat.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border border-midnight/8 bg-white p-5 shadow-premium">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-champagne p-1">
            {[
              { id: 'login', label: 'Masuk' },
              { id: 'register', label: 'Daftar' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setMode(tab.id); setError(null); setMessage(null) }}
                className={`rounded-md py-2.5 font-jakarta text-[11px] font-extrabold uppercase tracking-[0.12em] transition-all ${
                  mode === tab.id
                    ? 'bg-midnight text-white shadow-sm'
                    : 'text-muted hover:text-midnight'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <label className="mb-2 block font-jakarta text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
            className="mb-4 w-full rounded-lg border border-midnight/10 bg-champagne px-4 py-3.5 text-[14.5px] font-semibold text-midnight outline-none transition-all placeholder:text-muted/50 focus:border-gold/50 focus:bg-white focus:ring-2 focus:ring-gold/20"
          />

          {mode !== 'magic' && (
            <>
              <label className="mb-2 block font-jakarta text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                minLength={6}
                className="w-full rounded-lg border border-midnight/10 bg-champagne px-4 py-3.5 text-[14.5px] font-semibold text-midnight outline-none transition-all placeholder:text-muted/50 focus:border-gold/50 focus:bg-white focus:ring-2 focus:ring-gold/20"
              />
            </>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-600">
              {error}
            </p>
          )}
          {message && (
            <p className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-[12px] font-semibold text-emerald-700">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full rounded-lg bg-midnight py-4 font-jakarta text-[12px] font-extrabold uppercase tracking-[0.14em] text-white shadow-lg shadow-midnight/15 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            {loading
              ? 'Memproses...'
              : mode === 'register'
                ? 'Buat akun'
                : mode === 'magic'
                  ? 'Kirim link'
                  : 'Masuk'}
          </button>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'magic' ? 'login' : 'magic')
                setError(null)
                setMessage(null)
              }}
              className="font-jakarta text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted transition-colors hover:text-midnight"
            >
              {mode === 'magic' ? 'Pakai password' : 'Masuk via link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
