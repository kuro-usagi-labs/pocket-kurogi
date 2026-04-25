import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { TransactionIcon } from '../shared/CategoryIcon'

export default function HistoryView({
  transactions,
  formatRupiah,
  onDeleteTransaction,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}) {
  const [query, setQuery] = useState('')
  const filteredTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return transactions
    }

    return transactions.filter((transaction) => {
      const haystack = [
        transaction.title,
        transaction.desc,
        transaction.subtitle,
        transaction.wallet,
        transaction.category,
        transaction.date,
      ].filter(Boolean).join(' ').toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [query, transactions])

  return (
    <div className="mx-auto max-w-5xl px-4 pb-6 pt-5 md:px-6 md:pb-8 md:pt-6">
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="font-jakarta text-[22px] font-extrabold tracking-tight text-midnight">Histori</h2>
        <p className="text-[13px] font-semibold text-muted">{transactions.length} transaksi</p>
      </div>

      <div className="relative mb-5 flex items-center rounded-lg border border-midnight/10 bg-white p-1 shadow-sm">
        <div className="px-3 text-muted">
          <Search size={18} strokeWidth={2} />
        </div>
        <input
          className="w-full border-none bg-transparent px-1 py-2.5 font-jakarta text-[14.5px] font-semibold text-midnight outline-none placeholder:text-muted/50 focus:ring-0 md:py-2"
          placeholder="Cari transaksi..."
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="space-y-3">
        {transactions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-midnight/15 bg-white px-5 py-10 text-center shadow-sm">
            <p className="font-jakarta text-[13px] font-bold text-midnight">Belum ada transaksi.</p>
            <p className="mt-1 text-[12px] font-medium text-muted">Mulai dari chat.</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-midnight/15 bg-white px-5 py-10 text-center shadow-sm">
            <p className="font-jakarta text-[13px] font-bold text-midnight">Tidak ditemukan.</p>
          </div>
        ) : (
          <>
            {filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="group relative rounded-lg border border-midnight/8 bg-white p-4 shadow-sm transition-all hover:border-midnight/14 hover:shadow-premium md:flex md:items-center md:justify-between md:gap-4 md:p-5"
              >
                {transaction.canDelete && (
                  <button
                    onClick={() => onDeleteTransaction(transaction.id)}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-muted/50 opacity-100 transition-all hover:bg-red-50 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100"
                    title="Hapus transaksi"
                    aria-label="Hapus transaksi"
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                )}

                <div className="flex min-w-0 items-center gap-3 pr-8 md:flex-1 md:pr-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-midnight/8 bg-champagne text-midnight">
                    <TransactionIcon
                      iconKey={transaction.iconKey}
                      category={transaction.category}
                      size={21}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 font-jakarta text-[14.5px] font-extrabold leading-snug tracking-tight text-midnight md:truncate">
                      {transaction.title || transaction.desc}
                    </h3>
                    <p className="mt-1 line-clamp-1 text-[12px] font-medium text-muted md:truncate">
                      {[transaction.subtitle, transaction.date, transaction.time].filter(Boolean).join(' - ')}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between gap-3 border-t border-midnight/8 pt-3 text-right md:mt-0 md:block md:shrink-0 md:border-t-0 md:pt-0">
                  <p className="max-w-[58%] truncate text-left font-jakarta text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted/70 md:hidden">
                    {transaction.wallet}
                  </p>
                  <p
                    className={`font-jakarta text-[14px] font-extrabold tracking-tight md:text-[15.5px] ${
                      transaction.type === 'income' ? 'text-emerald-600' : 'text-midnight'
                    }`}
                  >
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatRupiah(transaction.amount)}
                  </p>
                  <p className="mt-1 hidden text-[9.5px] font-extrabold uppercase tracking-widest text-muted/70 md:block">
                    {transaction.wallet}
                  </p>
                </div>
              </div>
            ))}

            {hasMore && !query.trim() && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={onLoadMore}
                  className="rounded-lg border border-midnight/10 bg-white px-4 py-2 font-jakarta text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted shadow-sm transition-colors hover:text-midnight"
                >
                  {loadingMore ? 'Memuat...' : 'Muat lagi'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
