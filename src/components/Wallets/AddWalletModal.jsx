import { useState } from 'react'
import { X } from 'lucide-react'

export default function AddWalletModal({ onClose, onSubmit }) {
  const [name, setName] = useState('')
  const [balance, setBalance] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || submitting) return

    setSubmitting(true)
    setErrorMessage('')
    const result = await onSubmit(name.trim(), parseFloat(balance) || 0)

    if (result?.error) {
      setErrorMessage(result.error.message || 'Dompet belum bisa dibuat.')
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/40 p-4 backdrop-blur-md transition-opacity animate-fade-in">
      <div className="w-full max-w-[360px] rounded-lg border border-white/30 bg-white p-5 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-jakarta text-[20px] font-extrabold tracking-tight text-midnight">
            Dompet Baru
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg border border-midnight/8 bg-champagne p-2 text-muted transition-colors hover:text-midnight"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="mb-2 block font-jakarta text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-muted">
              Nama dompet
            </label>
            <input
              required
              type="text"
              placeholder="Contoh: BCA"
              className="w-full rounded-lg border border-midnight/10 bg-champagne px-4 py-3.5 font-inter text-[14.5px] font-semibold text-midnight transition-all placeholder:text-muted/50 focus:border-gold/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/20"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="mb-8">
            <label className="mb-2 block font-jakarta text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-muted">
              Saldo awal
            </label>
            <input
              required
              type="number"
              placeholder="500000"
              className="w-full rounded-lg border border-midnight/10 bg-champagne px-4 py-3.5 font-inter text-[14.5px] font-semibold text-midnight transition-all placeholder:text-muted/50 focus:border-gold/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/20"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
          </div>
          {errorMessage ? (
            <p className="mb-4 text-[12px] font-semibold text-red-600">
              {errorMessage}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-midnight py-4 font-jakarta text-[12px] font-extrabold uppercase tracking-[0.14em] text-white shadow-lg shadow-midnight/15 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? 'Memproses...' : 'Simpan'}
          </button>
        </form>
      </div>
    </div>
  )
}
