import { useState } from 'react'
import { X, Target, Calendar, DollarSign } from 'lucide-react'

export default function AddGoalModal({ onClose, onSubmit }) {
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [deadline, setDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || !targetAmount || submitting) return

    setSubmitting(true)
    setErrorMessage('')
    const result = await onSubmit({
      name,
      targetAmount: Number(targetAmount),
      deadline: deadline || null,
      icon: 'target'
    })

    if (result?.error) {
      setErrorMessage(result.error.message || 'Target belum bisa dibuat.')
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-midnight/35 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[24px] bg-white shadow-2xl animate-scale-in">
        <div className="p-5 md:p-6">
          <div className="mb-7 flex items-center justify-between">
            <div>
              <h3 className="font-jakarta text-[24px] font-extrabold tracking-tight text-midnight">Target Baru</h3>
              <p className="mt-1 text-[15px] font-medium text-muted">Nominal dan deadline.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-champagne text-muted transition-colors hover:text-midnight"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="ml-1 font-jakarta text-[12px] font-extrabold uppercase tracking-[0.14em] text-muted">Nama target</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                  <Target size={18} />
                </div>
                <input
                  autoFocus
                  type="text"
                  required
                  placeholder="Contoh: Dana Darurat"
                  className="w-full rounded-[16px] border border-midnight/10 bg-champagne py-4 pl-11 pr-4 text-[16px] font-medium text-midnight outline-none transition-all placeholder:text-muted/50 focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="ml-1 font-jakarta text-[12px] font-extrabold uppercase tracking-[0.14em] text-muted">Nominal</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                  <DollarSign size={18} />
                </div>
                <input
                  type="number"
                  required
                  placeholder="0"
                  className="w-full rounded-[16px] border border-midnight/10 bg-champagne py-4 pl-11 pr-4 text-[16px] font-medium text-midnight outline-none transition-all placeholder:text-muted/50 focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="ml-1 font-jakarta text-[12px] font-extrabold uppercase tracking-[0.14em] text-muted">Deadline</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                  <Calendar size={18} />
                </div>
                <input
                  type="date"
                  className="w-full rounded-[16px] border border-midnight/10 bg-champagne py-4 pl-11 pr-4 text-[16px] font-medium text-midnight outline-none transition-all placeholder:text-muted/50 focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-[16px] bg-emerald-500 py-4 font-jakarta text-[15px] font-extrabold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? 'Memproses...' : 'Simpan'}
            </button>
            {errorMessage ? (
              <p className="text-[12px] font-semibold text-red-600">
                {errorMessage}
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  )
}
