import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import OverlayPortal from '../shared/OverlayPortal'
import { formatWalletAdjustmentBalance as formatRupiah, isValidWalletBalance } from '../../lib/walletBalanceAdjustment'

export default function AdjustBalanceModal({ wallet, onSubmit, onClose }) {
  const [value, setValue] = useState(String(wallet.current_balance))
  const [review, setReview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(null)
  const dialogRef = useRef(null)
  const busyRef = useRef(false)
  const triggerRef = useRef(typeof document !== 'undefined' ? document.activeElement : null)
  const targetBalance = value.trim() ? Number(value) : NaN
  const valid = isValidWalletBalance(targetBalance)

  useEffect(() => () => { triggerRef.current?.focus?.() }, [])
  useEffect(() => {
    const dialog = dialogRef.current
    const focusable = () => [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')]
    if (!dialog.contains(document.activeElement)) (dialog.querySelector('input') || focusable()[0] || dialog).focus()
    const keydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!busyRef.current) onClose()
      }
      if (event.key !== 'Tab') return
      const elements = focusable()
      const first = elements[0]
      const last = elements.at(-1)
      if (!first) { event.preventDefault(); dialog.focus(); return }
      if (event.shiftKey && (document.activeElement === first || !elements.includes(document.activeElement))) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !elements.includes(document.activeElement))) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', keydown)
    return () => document.removeEventListener('keydown', keydown)
  }, [onClose, review, submitting])

  const submit = async (event) => {
    event.preventDefault()
    if (!valid || busyRef.current) return
    if (!review) { setReview(true); return }
    requestId.current ||= crypto.randomUUID()
    busyRef.current = true
    setSubmitting(true)
    setError('')
    try {
      const result = await onSubmit(wallet.id, Number(wallet.current_balance), targetBalance, requestId.current)
      if (result?.error) setError(result.error.message || 'Saldo belum bisa disesuaikan. Coba lagi.')
      else onClose()
    } catch (failure) { setError(failure.message || 'Saldo belum bisa disesuaikan.') }
    finally { busyRef.current = false; setSubmitting(false) }
  }

  return <OverlayPortal>
    <div className="fixed inset-0 z-[130] flex items-end justify-center p-3 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-midnight/30 backdrop-blur-md" onClick={() => { if (!busyRef.current) onClose() }} />
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-busy={submitting} aria-label="Sesuaikan saldo" className="relative w-full max-w-md rounded-[20px] bg-white p-6 text-midnight shadow-2xl">
        <div className="mb-4 flex items-center justify-between"><h3 className="text-xl font-extrabold">Sesuaikan saldo {wallet.name}</h3><button aria-label="Tutup" disabled={submitting} onClick={onClose}><X size={20} /></button></div>
        <p className="mb-4 text-sm text-muted">Dicatat sebagai penyesuaian saldo. Tidak dihitung sebagai pemasukan atau pengeluaran.</p>
        <form onSubmit={submit} className="space-y-4">
          {review ? <div className="rounded-xl bg-champagne p-4"><p>Saldo sebelumnya: {formatRupiah(wallet.current_balance)}</p><p className="mt-2 font-bold">Saldo akhir: {formatRupiah(targetBalance)}</p></div> : <label className="block text-sm font-semibold">Saldo akhir yang benar (Rp)<input autoFocus type="number" min="0" max="9999999999999.99" step="0.01" required value={value} onChange={(event) => { setValue(event.target.value); requestId.current = null }} className="mt-2 w-full rounded-xl border border-midnight/10 bg-champagne p-4 text-base" /></label>}
          {error && <p role="alert" className="text-sm text-red-600">{error} Jika saldo telah berubah, tutup dialog lalu buka kembali untuk meninjau saldo terbaru.</p>}
          <div className="flex gap-3"><button type="button" disabled={submitting} onClick={() => review ? setReview(false) : onClose()} className="flex-1 rounded-xl bg-champagne p-3">{review ? 'Kembali' : 'Batal'}</button><button disabled={!valid || submitting} className="flex-1 rounded-xl bg-midnight p-3 font-bold text-white disabled:opacity-50">{submitting ? 'Menyimpan…' : review ? 'Konfirmasi saldo' : 'Tinjau perubahan'}</button></div>
        </form>
      </section>
    </div>
  </OverlayPortal>
}
