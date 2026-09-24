import { useEffect, useRef, useState } from 'react'
import OverlayPortal from '../shared/OverlayPortal'
import { buildEditedDraft } from '../../lib/assistant/draftEditor'
import { parseAmountInput } from '../../lib/transactionAmountInput'
import { formatMoney } from '../../lib/formatMoney'

const control = 'mt-1 min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-midnight'

export default function DraftEditorModal({ action, wallets, categories, onClose, onSave }) {
  const [rows, setRows] = useState(() => action.payload.items.map(item => ({ ...item, amountText: Number(item.amount).toLocaleString('id-ID'), description: item.description || item.merchant || '' })))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const panel = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    panel.current?.querySelector('input')?.focus()
    return () => previous?.focus()
  }, [])
  const update = (index, patch) => { setError(''); setRows(current => current.map((row, i) => i === index ? { ...row, ...patch } : row)) }
  const submit = async event => {
    event.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      await onSave(action, buildEditedDraft(action, rows, wallets, categories))
      onClose()
    } catch (failure) {
      setError(failure.message || 'Draft belum bisa diperbarui. Coba lagi.')
    } finally { setBusy(false) }
  }
  const keyDown = event => {
    if (event.key === 'Escape' && !busy) onClose()
    if (event.key !== 'Tab') return
    const nodes = [...panel.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')]
    const first = nodes[0], last = nodes.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  const total = type => rows.filter(row => row.transactionType === type).reduce((sum, row) => sum + Math.round(parseAmountInput(row.amountText) * 100), 0) / 100
  return <OverlayPortal><div className="fixed inset-0 z-[135] flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center">
    <section ref={panel} role="dialog" aria-modal="true" aria-label="Edit draft transaksi" onKeyDown={keyDown} className="max-h-[calc(100dvh-24px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-5 text-midnight sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Edit draft transaksi</h2><p className="mt-1 text-sm text-muted">{rows.length} transaksi · Belum dicatat. Tinjau kembali setelah disimpan.</p></div><button type="button" aria-label="Tutup editor draft" disabled={busy} onClick={onClose} className="min-h-11 px-3">✕</button></div>
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          {rows.map((row, index) => <div key={row.clientItemId || index} className="rounded-xl border border-[var(--line)] p-4">
            <h3 className="mb-3 font-semibold">Transaksi {index + 1}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">Jenis<select className={control} value={row.transactionType} onChange={event => update(index, { transactionType: event.target.value, categoryId: '' })}><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></select></label>
              <label className="text-sm">Nominal<input aria-label="Nominal" className={control} inputMode="decimal" value={row.amountText} onChange={event => update(index, { amountText: event.target.value })} /><span className="mt-1 block text-xs text-muted">{formatMoney(parseAmountInput(row.amountText))}</span></label>
              <label className="text-sm">Dompet<select className={control} value={row.walletId} onChange={event => update(index, { walletId: event.target.value })}><option value="">Pilih dompet</option>{wallets.filter(wallet => !wallet.is_archived).map(wallet => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select></label>
              <label className="text-sm">Kategori<select className={control} value={row.categoryId || ''} onChange={event => update(index, { categoryId: event.target.value })}><option value="">Pilih kategori</option>{categories.filter(category => ['both', row.transactionType].includes(category.category_type || 'expense')).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label className="text-sm sm:col-span-2">Catatan<input className={control} maxLength={240} value={row.description} onChange={event => update(index, { description: event.target.value })} /></label>
            </div>
          </div>)}
        </fieldset>
        <p className="text-sm">Masuk {formatMoney(total('income'))} · Keluar {formatMoney(total('expense'))}</p>
        {error && <p role="alert" className="text-sm text-[var(--danger-ink)]">{error}</p>}
        <div className="sticky -bottom-5 flex gap-3 border-t border-[var(--line)] bg-[var(--surface-strong)] py-4 sm:-bottom-6"><button type="button" disabled={busy} onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-[var(--line)]">Batal</button><button disabled={busy} className="min-h-11 flex-1 rounded-xl bg-[var(--accent)] px-3 text-white disabled:opacity-50">{busy ? 'Menyimpan…' : 'Simpan draft'}</button></div>
      </form>
    </section>
  </div></OverlayPortal>
}
