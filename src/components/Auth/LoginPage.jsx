import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function LoginPage() {
  const { signInWithPassword, signUp, signInWithMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'magic'
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
      else setMessage('Magic link telah dikirim ke email Anda.')
    } else if (mode === 'register') {
      const { error } = await signUp(email, password)
      if (error) setError(error.message)
      else setMessage('Akun berhasil dibuat! Silakan cek email untuk konfirmasi, atau langsung login.')
    } else {
      const { error } = await signInWithPassword(email, password)
      if (error) setError(error.message)
    }

    setLoading(false)
  }

  return (
    <div className="h-[100dvh] w-full flex items-center justify-center bg-champagne font-inter px-6">
      <div className="w-full max-w-[380px] animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-full bg-midnight flex items-center justify-center text-white shadow-xl shadow-midnight/30 mb-6">
            <Sparkles size={28} strokeWidth={1.5} />
          </div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-midnight font-jakarta">
            Pocket Kurogi
          </h1>
          <p className="text-muted/60 text-[13px] mt-2 font-medium text-center leading-relaxed max-w-[260px]">
            Your private financial analyst. Intelligent. Minimal. Elegant.
          </p>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-[28px] p-8 border border-midnight/5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            {/* Mode Tabs */}
            <div className="flex bg-ivory rounded-2xl p-1 mb-7 border border-midnight/5">
              {[
                { id: 'login', label: 'Masuk' },
                { id: 'register', label: 'Daftar' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { setMode(tab.id); setError(null); setMessage(null) }}
                  className={`flex-1 py-2.5 rounded-xl text-[11px] font-extrabold uppercase tracking-[0.15em] font-jakarta transition-all ${
                    mode === tab.id
                      ? 'bg-midnight text-white shadow-md'
                      : 'text-muted/50 hover:text-midnight'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Email */}
            <label className="block text-[10px] font-extrabold text-muted uppercase mb-2 tracking-[0.15em] font-jakarta">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="analyst@kurogi.io"
              className="w-full bg-ivory border border-midnight/10 rounded-2xl px-4 py-3.5 text-[14.5px] font-semibold text-midnight focus:outline-none focus:ring-1 focus:ring-midnight/40 font-inter transition-all placeholder:text-midnight/25 mb-4"
            />

            {/* Password (not shown for magic link) */}
            {mode !== 'magic' && (
              <>
                <label className="block text-[10px] font-extrabold text-muted uppercase mb-2 tracking-[0.15em] font-jakarta">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full bg-ivory border border-midnight/10 rounded-2xl px-4 py-3.5 text-[14.5px] font-semibold text-midnight focus:outline-none focus:ring-1 focus:ring-midnight/40 font-inter transition-all placeholder:text-midnight/25"
                />
              </>
            )}

            {/* Error & Success Messages */}
            {error && (
              <p className="text-red-500 text-xs mt-3 font-medium bg-red-50 rounded-xl px-4 py-2.5">{error}</p>
            )}
            {message && (
              <p className="text-emerald-600 text-xs mt-3 font-medium bg-emerald-50 rounded-xl px-4 py-2.5">{message}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-midnight text-white font-bold font-jakarta text-[12px] uppercase tracking-[0.2em] py-4 rounded-2xl shadow-xl shadow-midnight/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading
                ? 'Memproses...'
                : mode === 'register'
                ? 'Buat Akun'
                : mode === 'magic'
                ? 'Kirim Magic Link'
                : 'Masuk'}
            </button>

            {/* Magic Link Toggle */}
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'magic' ? 'login' : 'magic')
                  setError(null)
                  setMessage(null)
                }}
                className="text-[10.5px] font-bold text-muted/40 hover:text-midnight transition-colors uppercase tracking-widest"
              >
                {mode === 'magic' ? '← Kembali ke Login' : 'Masuk tanpa password →'}
              </button>
            </div>
          </div>
        </form>

        <p className="text-center text-[10px] text-muted/30 mt-8 font-medium tracking-wide">
          POWERED BY SUPABASE + GEMINI AI
        </p>
      </div>
    </div>
  )
}
