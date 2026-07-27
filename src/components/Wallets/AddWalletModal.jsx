import { useState } from 'react'
import { X } from 'lucide-react'
import OverlayPortal from '../shared/OverlayPortal'

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
    <OverlayPortal>
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-midnight/35 p-3 backdrop-blur-md transition-opacity animate-fade-in sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Dompet baru"
        className="max-h-[calc(100dvh-24px)] w-full max-w-[390px] overflow-y-auto overscroll-contain rounded-[20px] border border-midnight/10 bg-white p-5 shadow-2xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-jakarta text-[24px] font-extrabold tracking-tight text-midnight">
            Dompet Baru
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-[12px] border border-midnight/8 bg-champagne p-2.5 text-muted transition-colors hover:text-midnight"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="mb-2 block font-jakarta text-[12px] font-extrabold  text-muted">
              Nama dompet
            </label>
            <input
              required
              type="text"
              placeholder="Contoh: BCA"
              className="w-full rounded-[16px] border border-midnight/10 bg-champagne px-4 py-4 font-inter text-[16px] font-medium text-midnight transition-all placeholder:text-muted/50 focus:border-orange-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="mb-6">
            <label className="mb-2 block font-jakarta text-[12px] font-extrabold  text-muted">
              Saldo awal
            </label>
            <input
              required
              type="number"
              placeholder="500000"
              className="w-full rounded-[16px] border border-midnight/10 bg-champagne px-4 py-4 font-inter text-[16px] font-medium text-midnight transition-all placeholder:text-muted/50 focus:border-orange-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
          </div>
          {errorMessage ? (
            <p className="mb-4 rounded-[12px] bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-600">
              {errorMessage}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-[16px] bg-orange-700 py-4 font-jakarta text-[15px] font-extrabold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-700 active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? 'Memproses...' : 'Simpan'}
          </button>
        </form>
      </div>
    </div>
    </OverlayPortal>
  )
}
