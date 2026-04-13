import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function LoginPage() {
  const { signInWithMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await signInWithMagicLink(email)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="h-[100dvh] w-full flex items-center justify-center bg-champagne font-inter px-6">
      <div className="w-full max-w-[380px] animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-12">
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

        {sent ? (
          /* Success state */
          <div className="bg-white rounded-[28px] p-8 border border-midnight/5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] text-center">
            <div className="w-14 h-14 rounded-full bg-cream mx-auto flex items-center justify-center mb-5">
              <span className="text-2xl">✉️</span>
            </div>
            <h2 className="font-jakarta font-bold text-lg text-midnight mb-2">Cek Email Anda</h2>
            <p className="text-muted/60 text-sm leading-relaxed">
              Magic link telah dikirim ke<br />
              <strong className="text-midnight">{email}</strong>
            </p>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              className="mt-6 text-xs font-bold text-muted/40 hover:text-midnight transition-colors uppercase tracking-widest"
            >
              Gunakan Email Lain
            </button>
          </div>
        ) : (
          /* Login form */
          <form onSubmit={handleSubmit}>
            <div className="bg-white rounded-[28px] p-8 border border-midnight/5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <label className="block text-[10px] font-extrabold text-muted uppercase mb-3 tracking-[0.15em] font-jakarta">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@kurogi.io"
                className="w-full bg-ivory border border-midnight/10 rounded-2xl px-4 py-3.5 text-[14.5px] font-semibold text-midnight focus:outline-none focus:ring-1 focus:ring-midnight/40 font-inter transition-all placeholder:text-midnight/25"
              />

              {error && (
                <p className="text-red-500 text-xs mt-3 font-medium">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 bg-midnight text-white font-bold font-jakarta text-[12px] uppercase tracking-[0.2em] py-4 rounded-2xl shadow-xl shadow-midnight/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? 'Mengirim...' : 'Masuk dengan Magic Link'}
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-[10px] text-muted/30 mt-8 font-medium tracking-wide">
          POWERED BY SUPABASE + GEMINI AI
        </p>
      </div>
    </div>
  )
}
