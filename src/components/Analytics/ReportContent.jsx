import { useEffect, useRef, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import {
  BUCKET_LABELS,
  currentReportMonth,
  reportDate,
  reportMoney,
} from '../../lib/financialReport'
import EditTransactionModal from '../History/EditTransactionModal'

const panel =
  'rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-5'
const button =
  'rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-semibold disabled:opacity-50'

export default function ReportContent({
  ownerId,
  request,
  wallets,
  categories,
  onUpdateTransaction,
  formatRupiah,
}) {
  const [month, setMonth] = useState(currentReportMonth)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ status: 'loading' })
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [reviewOnly, setReviewOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState(null)
  const exportContext = useRef(null)
  useEffect(() => {
    exportContext.current = {}
    return () => {
      exportContext.current = null
    }
  }, [month, revision, ownerId])
  useEffect(() => {
    if (!ownerId) return
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
      setState({ status: 'error', error: 'Memuat laporan terlalu lama. Silakan coba lagi.', month, revision })
    }, 20000)
    request({
      operation: 'financial_report',
      body: { month },
      signal: controller.signal,
    })
      .then((report) => {
        clearTimeout(timeout)
        if (!controller.signal.aborted)
          setState({ status: 'success', report, month, revision })
      })
      .catch((error) => {
        clearTimeout(timeout)
        if (!controller.signal.aborted)
          setState({ status: 'error', error: error.message, month, revision })
      })
    return () => { clearTimeout(timeout); controller.abort() }
  }, [month, revision, ownerId, request])
  const fresh = state.month === month && state.revision === revision
  const report = fresh && state.status === 'success' ? state.report : null
  const rows =
    report?.transactions.filter((row) => (!reviewOnly || row.needsCategory) &&
      `${row.description} ${row.category} ${row.wallet}`.toLocaleLowerCase('id-ID').includes(search.trim().toLocaleLowerCase('id-ID'))) || []
  const pages = Math.max(1, Math.ceil(rows.length / 30))
  const activePage = Math.min(page, pages - 1)
  const exportPdf = async () => {
    if (!report || exporting) return
    setExporting(true)
    setExportError('')
    const context = exportContext.current
    try {
      const { createReportPdf } = await import('../../lib/reportPdf')
      const doc = await createReportPdf(report)
      if (context === exportContext.current)
        doc.save(`Pocket-Kurogi-Laporan-${report.period.month}.pdf`)
    } catch {
      setExportError(
        'PDF gagal dibuat. Silakan coba lagi; data transaksimu tidak berubah.'
      )
    } finally {
      setExporting(false)
    }
  }
  return (
    <div className="space-y-5 p-4 pb-24 text-[var(--ink)] sm:p-6 lg:pb-6">
      {editing && (
        <EditTransactionModal
          transaction={{
            ...editing,
            amount: editing.amount / 100,
            merchant: editing.description,
          }}
          wallets={wallets}
          categories={categories}
          formatRupiah={formatRupiah}
          onClose={() => setEditing(null)}
          onSubmit={async (payload) => {
            const result = await onUpdateTransaction(payload)
            if (!result?.error) setRevision((value) => value + 1)
            return result
          }}
        />
      )}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent-ink)]">
            Pocket Kurogi / Laporan
          </p>
          <h2 className="mt-2 text-2xl font-bold">
            Uangmu, dalam gambaran utuh.
          </h2>
          <p className="mt-2 text-sm text-[var(--muted-ink)]">
            Berdasarkan transaksi tersimpan. Periode menggunakan WIB.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm">
            Periode{' '}
            <select
              aria-label="Jenis periode"
              value={month === 'all' ? 'all' : 'month'}
              onChange={(e) => {
                setMonth(
                  e.target.value === 'all' ? 'all' : currentReportMonth()
                )
                setPage(0)
              }}
              className={button}
            >
              <option value="month">Bulanan</option>
              <option value="all">Seluruh periode</option>
            </select>
          </label>
          {month !== 'all' && (
            <input
              aria-label="Bulan laporan"
              type="month"
              min="2000-01"
              max="2099-12"
              value={month}
              onChange={(e) => {
                if (e.target.value) {
                  setMonth(e.target.value)
                  setPage(0)
                }
              }}
              className={button}
            />
          )}
          <button
            aria-label="Perbarui laporan"
            onClick={() => setRevision((value) => value + 1)}
            className={button}
          >
            <RefreshCw size={17} />
          </button>
          <button
            disabled={!report || exporting}
            onClick={exportPdf}
            className={`${button} flex items-center gap-2 bg-[var(--accent)] text-white`}
          >
            <Download size={17} />
            {exporting ? 'Membuat PDF…' : 'Unduh PDF'}
          </button>
        </div>
      </header>
      {exportError && <p role="alert">{exportError}</p>}
      {!report ? (
        <section className={panel} role="status">
          {fresh && state.status === 'error' ? (
            <>
              <h3 className="font-bold">Laporan belum dapat dimuat</h3>
              <p className="mt-2">{state.error}</p>
              <p className="mt-2 text-sm">
                Ini bukan berarti saldo atau transaksimu nol.
              </p>
              <button
                className={`${button} mt-4`}
                onClick={() => setRevision((value) => value + 1)}
              >
                Coba lagi
              </button>
            </>
          ) : (
            'Memuat seluruh transaksi periode ini…'
          )}
        </section>
      ) : (
        <>
          <div className="flex flex-wrap justify-between gap-2 text-sm text-[var(--muted-ink)]">
            <span>
              {report.period.label} · {report.transactions.length} transaksi
            </span>
            <span>
              Diperbarui{' '}
              {new Date(report.generatedAt).toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
              })}{' '}
              WIB
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Pemasukan', report.totals.income],
              ['Pengeluaran', report.totals.expense],
              ['Surplus / defisit operasional', report.totals.operatingNet],
              ['Alokasi tabungan neto', report.totals.savingsNet],
            ].map(([label, amount]) => (
              <section key={label} className={panel}>
                <p className="text-sm text-[var(--muted-ink)]">{label}</p>
                <p className="mt-3 break-words text-2xl font-bold">
                  {reportMoney(amount)}
                </p>
              </section>
            ))}
          </div>
          <section
            className={`${panel} border-[var(--accent-border)] bg-[var(--accent-soft)]`}
          >
            <h3 className="font-bold">Kesimpulan periode ini</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {report.insights.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </section>
          <div className="grid gap-5 xl:grid-cols-2">
            <section className={panel}>
              <h3 className="font-bold">Arus kas tercatat</h3>
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  ['Pemasukan operasional', report.totals.income],
                  ['Pengeluaran operasional (-)', report.totals.expense],
                  ['Surplus / defisit operasional', report.totals.operatingNet],
                  ['Setoran tabungan (-)', report.totals.savingIn],
                  ['Penarikan tabungan (+)', report.totals.savingOut],
                  ['Arus neto setelah tabungan', report.totals.afterSavings],
                  ['Transfer antar-dompet (informasi)', report.totals.transfer],
                  ['Saldo awal tercatat (informasi)', report.totals.opening],
                ].map(([label, amount]) => (
                  <div
                    key={label}
                    className="flex justify-between gap-4 border-b border-[var(--line)] pb-2"
                  >
                    <dt>{label}</dt>
                    <dd className="shrink-0 font-semibold">
                      {reportMoney(amount)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-[var(--muted-ink)]">
                Arus neto bukan saldo dompet. Transfer internal, saldo awal, dan
                koreksi saldo tidak dihitung sebagai pemasukan/pengeluaran
                operasional. Laporan pribadi berbasis kas tercatat, bukan
                laporan akuntansi perusahaan yang diaudit.
              </p>
            </section>
            <section className={panel}>
              <h3 className="font-bold">Rincian per kategori</h3>
              <div className="mt-4 max-h-96 space-y-4 overflow-y-auto">
                {report.categories.length ? (
                  report.categories.map((group) => (
                    <div key={`${group.type}:${group.name}`}>
                      <div className="flex justify-between gap-3 text-sm">
                        <div>
                          {group.name}
                          <p className="text-xs text-[var(--muted-ink)]">
                            {BUCKET_LABELS[group.type]} · {group.count}{' '}
                            transaksi
                          </p>
                        </div>
                        <strong>{reportMoney(group.amount)}</strong>
                      </div>
                      <div className="mt-2 h-1.5 rounded bg-[var(--surface)]">
                        <div
                          className="h-full rounded bg-[var(--accent)]"
                          style={{
                            width: `${report.totals[group.type] ? (group.amount / report.totals[group.type]) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm">
                    Belum ada pemasukan atau pengeluaran.
                  </p>
                )}
              </div>
            </section>
          </div>
          <section className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold">Buku transaksi</h3>
                <p className="mt-1 text-xs text-[var(--muted-ink)]">
                  Kategori mengikuti data tersimpan. Gunakan Koreksi untuk
                  meninjau kategori dan rincian transaksi.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reviewOnly}
                  onChange={(e) => {
                    setReviewOnly(e.target.checked)
                    setPage(0)
                  }}
                />
                Perlu kategori ({report.unclassified})
              </label>
            </div>
            <input aria-label="Cari transaksi laporan" type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="Cari keterangan, kategori, atau dompet" className="mt-4 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm" />
            <p className="mt-2 text-xs text-[var(--muted-ink)]">PDF selalu memuat seluruh transaksi periode terpilih, termasuk yang tidak tampil karena filter.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)]">
                    {[
                      'Tanggal',
                      'Keterangan',
                      'Kategori / kelompok',
                      'Dompet',
                      'Masuk',
                      'Keluar',
                    ].map((title) => (
                      <th key={title} className="whitespace-nowrap px-3 py-3">
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .slice(activePage * 30, (activePage + 1) * 30)
                    .map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-[var(--line)]"
                      >
                        <td className="whitespace-nowrap p-3">
                          {reportDate(row.occurredAt)}
                        </td>
                        <td className="min-w-40 max-w-80 break-words p-3">
                          {row.description}
                          {row.canEdit && onUpdateTransaction && (
                            <button
                              onClick={() => setEditing(row)}
                              className="mt-1 block text-xs font-bold text-[var(--accent-ink)] underline"
                              aria-label={`Koreksi ${row.description}`}
                            >
                              Koreksi
                            </button>
                          )}
                        </td>
                        <td className="p-3">
                          {row.category}
                          <p className="text-xs text-[var(--muted-ink)]">
                            {BUCKET_LABELS[row.bucket]}
                          </p>
                        </td>
                        <td className="p-3">{row.wallet}</td>
                        <td className="whitespace-nowrap p-3 text-right">
                          {row.type === 'income'
                            ? reportMoney(row.amount)
                            : '—'}
                        </td>
                        <td className="whitespace-nowrap p-3 text-right">
                          {row.type === 'expense'
                            ? reportMoney(row.amount)
                            : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!rows.length && (
                <p className="p-4 text-sm">
                  Tidak ada transaksi untuk ditampilkan.
                </p>
              )}
            </div>
            <div className="mt-4 flex items-center justify-end gap-3 text-sm">
              <button
                className={button}
                disabled={activePage === 0}
                onClick={() => setPage(activePage - 1)}
              >
                Sebelumnya
              </button>
              <span>
                {activePage + 1} / {pages}
              </span>
              <button
                className={button}
                disabled={activePage >= pages - 1}
                onClick={() => setPage(activePage + 1)}
              >
                Berikutnya
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
