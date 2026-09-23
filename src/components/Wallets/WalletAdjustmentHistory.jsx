import { useEffect, useRef } from 'react'
import OverlayPortal from '../shared/OverlayPortal'
import { formatMoney } from '../../lib/formatMoney'

export default function WalletAdjustmentHistory({ wallet, onClose, items = [], status, error, hasMore, loadMore, retry }) {
  const dialog = useRef(null)
  useEffect(() => {
    const trigger = document.activeElement
    const element = dialog.current
    element.querySelector('button')?.focus()
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (event.key !== 'Tab') return
      const buttons = [...element.querySelectorAll('button:not(:disabled)')]
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus() }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus() }
    }
    element.addEventListener('keydown', keydown)
    return () => { element.removeEventListener('keydown', keydown); trigger?.focus?.() }
  }, [onClose])
  return <OverlayPortal><div className="fixed inset-0 z-[130] flex items-end justify-center bg-midnight/30 p-3 backdrop-blur-sm sm:items-center">
    <section ref={dialog} role="dialog" aria-modal="true" aria-label={`Riwayat penyesuaian ${wallet.name}`} className="relative max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 text-midnight shadow-xl">
      <header className="flex items-start justify-between gap-3"><h2 className="text-lg font-bold">Riwayat penyesuaian {wallet.name}</h2><button type="button" className="min-h-11 px-3" onClick={onClose}>Tutup</button></header>
      <p className="mb-4 text-sm text-muted">Penyesuaian saldo tidak dihitung sebagai pemasukan atau pengeluaran. Untuk mengoreksi, buat penyesuaian baru.</p>
      {items.map(item => <article key={item.id} className="mb-3 rounded-xl border border-midnight/10 p-4 text-sm">
        <time className="text-xs text-muted">{new Date(item.created_at).toLocaleString('id-ID')}</time>
        <p className="mt-2">{formatMoney(item.previous_balance)} → <strong>{formatMoney(item.target_balance)}</strong></p>
        <p className="mt-1">Selisih {formatMoney(item.difference)}</p>
      </article>)}
      {status === 'loading' && <p role="status">Memuat penyesuaian…</p>}
      {error && <div role="alert"><p>Riwayat belum berhasil dimuat.</p><button type="button" className="min-h-11 font-bold underline" onClick={retry}>Coba lagi</button></div>}
      {status === 'success' && !items.length && <p>Belum ada penyesuaian saldo.</p>}
      {hasMore && <button type="button" disabled={status === 'loading'} onClick={loadMore} className="mt-3 min-h-11 w-full rounded-xl border font-bold">Muat lagi</button>}
    </section>
  </div></OverlayPortal>
}
