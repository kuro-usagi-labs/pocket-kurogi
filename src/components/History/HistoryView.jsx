import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronRight, Search, X } from 'lucide-react'
import { TransactionIcon, WalletIcon } from '../shared/CategoryIcon'

export default function HistoryView({
  transactions,
  formatRupiah,
  onDeleteTransaction,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const filteredTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return transactions.filter((transaction) => {
      if (filter !== 'all' && transaction.type !== filter) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

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
  }, [filter, query, transactions])

  const groupedTransactions = useMemo(() => {
    return filteredTransactions.reduce((groups, transaction) => {
      const label = transaction.date || 'Transaksi'
      if (!groups[label]) {
        groups[label] = []
      }
      groups[label].push(transaction)
      return groups
    }, {})
  }, [filteredTransactions])

  return (
    <div className="mx-auto max-w-5xl px-4 pb-7 pt-2 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-col gap-1.5">
        <h2 className="font-jakarta text-[28px] font-extrabold tracking-tight text-midnight sm:text-[32px]">Histori</h2>
        <p className="text-[14px] font-semibold text-muted">{transactions.length} transaksi</p>
      </div>

      <div className="relative mb-3 flex min-h-[54px] items-center rounded-[16px] border border-midnight/10 bg-white p-1.5 shadow-sm">
        <div className="px-3 text-midnight/70">
          <Search size={22} strokeWidth={2} />
        </div>
        <input
          className="w-full border-none bg-transparent px-1 py-2.5 font-jakarta text-[14px] font-medium text-midnight outline-none placeholder:text-muted/70 focus:ring-0"
          placeholder="Cari transaksi, kategori, atau catatan"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto no-scrollbar">
        <FilterButton active={filter === 'all'} label="Semua" onClick={() => setFilter('all')} />
        <FilterButton active={filter === 'income'} label="Masuk" icon={ArrowDown} onClick={() => setFilter('income')} />
        <FilterButton active={filter === 'expense'} label="Keluar" icon={ArrowUp} danger onClick={() => setFilter('expense')} />
      </div>

      <div className="space-y-6">
        {transactions.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-midnight/15 bg-white px-5 py-10 text-center shadow-sm">
            <p className="font-jakarta text-[13px] font-bold text-midnight">Belum ada transaksi.</p>
            <p className="mt-1 text-[12px] font-medium text-muted">Mulai dari chat.</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-midnight/15 bg-white px-5 py-10 text-center shadow-sm">
            <p className="font-jakarta text-[13px] font-bold text-midnight">Tidak ditemukan.</p>
          </div>
        ) : (
          <>
            {Object.entries(groupedTransactions).map(([dateLabel, items]) => (
              <section key={dateLabel}>
                <h3 className="mb-2.5 font-jakarta text-[16px] font-bold text-muted">{dateLabel}</h3>
                <div className="overflow-hidden rounded-[18px] border border-midnight/10 bg-white shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
                  {items.map((transaction) => (
                    <TransactionRow
                      key={transaction.id}
                      transaction={transaction}
                      formatRupiah={formatRupiah}
                      onDeleteTransaction={onDeleteTransaction}
                    />
                  ))}
                </div>
              </section>
            ))}

            {hasMore && !query.trim() && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={onLoadMore}
                  className="rounded-[16px] border border-midnight/10 bg-white px-5 py-3 font-jakarta text-[13px] font-bold text-muted shadow-sm transition-colors hover:text-midnight"
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

function FilterButton({ active, label, icon: Icon, danger = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-[14px] border px-4 font-jakarta text-[13px] font-bold transition-all ${
        active
          ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
          : 'border-midnight/10 bg-white text-midnight hover:border-emerald-200'
      }`}
    >
      {Icon ? (
        <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${active ? 'border-white/70' : danger ? 'border-red-400 text-red-500' : 'border-emerald-500 text-emerald-600'}`}>
          <Icon size={14} strokeWidth={2.2} />
        </span>
      ) : null}
      {label}
    </button>
  )
}

function TransactionRow({ transaction, formatRupiah, onDeleteTransaction }) {
  const isIncome = transaction.type === 'income'

  return (
    <div className="group relative flex items-center gap-3 border-b border-midnight/8 px-3.5 py-3.5 last:border-b-0 sm:px-5">
      {transaction.canDelete && (
        <button
          onClick={() => onDeleteTransaction(transaction.id)}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-muted/40 opacity-100 transition-all hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
          title="Hapus transaksi"
          aria-label="Hapus transaksi"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      )}

      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
        {transaction.wallet ? (
          <WalletIcon walletName={transaction.wallet} size={24} />
        ) : (
          <TransactionIcon iconKey={transaction.iconKey} category={transaction.category} size={22} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 font-jakarta text-[15px] font-extrabold tracking-tight text-midnight sm:text-[16px]">
          {transaction.title || transaction.desc}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${isIncome ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {isIncome ? 'Pemasukan' : 'Pengeluaran'}
          </span>
          <span className="text-[12px] font-medium text-muted">
            {[transaction.subtitle, transaction.time].filter(Boolean).join('  •  ')}
          </span>
        </div>
      </div>

      <div className="shrink-0 pr-3 text-right sm:pr-5">
        <p className={`max-w-[108px] truncate font-jakarta text-[15px] font-bold tracking-tight sm:max-w-none sm:text-[16px] ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>
          {isIncome ? '+' : '-'}{formatRupiah(transaction.amount)}
        </p>
      </div>
      <ChevronRight size={23} className="hidden shrink-0 text-muted sm:block" />
    </div>
  )
}
