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
    <div className="mx-auto max-w-5xl px-5 pb-8 pt-3 sm:px-8 lg:px-10">
      <div className="mb-6 flex flex-col gap-2">
        <h2 className="font-jakarta text-[34px] font-extrabold tracking-tight text-midnight sm:text-[42px]">Histori</h2>
        <p className="text-[18px] font-medium text-muted">{transactions.length} transaksi</p>
      </div>

      <div className="relative mb-4 flex min-h-[68px] items-center rounded-[18px] border border-midnight/10 bg-white p-2 shadow-sm">
        <div className="px-4 text-midnight/70">
          <Search size={28} strokeWidth={2} />
        </div>
        <input
          className="w-full border-none bg-transparent px-1 py-3 font-jakarta text-[16px] font-medium text-midnight outline-none placeholder:text-muted/70 focus:ring-0"
          placeholder="Cari transaksi, kategori, atau catatan"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="mb-7 flex gap-3 overflow-x-auto no-scrollbar">
        <FilterButton active={filter === 'all'} label="Semua" onClick={() => setFilter('all')} />
        <FilterButton active={filter === 'income'} label="Masuk" icon={ArrowDown} onClick={() => setFilter('income')} />
        <FilterButton active={filter === 'expense'} label="Keluar" icon={ArrowUp} danger onClick={() => setFilter('expense')} />
      </div>

      <div className="space-y-8">
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
                <h3 className="mb-3 font-jakarta text-[20px] font-bold text-muted">{dateLabel}</h3>
                <div className="overflow-hidden rounded-[22px] border border-midnight/10 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.04)]">
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
      className={`inline-flex min-h-[58px] shrink-0 items-center justify-center gap-2 rounded-[16px] border px-6 font-jakarta text-[16px] font-bold transition-all ${
        active
          ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
          : 'border-midnight/10 bg-white text-midnight hover:border-emerald-200'
      }`}
    >
      {Icon ? (
        <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${active ? 'border-white/70' : danger ? 'border-red-400 text-red-500' : 'border-emerald-500 text-emerald-600'}`}>
          <Icon size={16} strokeWidth={2.2} />
        </span>
      ) : null}
      {label}
    </button>
  )
}

function TransactionRow({ transaction, formatRupiah, onDeleteTransaction }) {
  const isIncome = transaction.type === 'income'

  return (
    <div className="group relative flex items-center gap-4 border-b border-midnight/8 px-4 py-4 last:border-b-0 sm:px-5">
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

      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
        {transaction.wallet ? (
          <WalletIcon walletName={transaction.wallet} size={28} />
        ) : (
          <TransactionIcon iconKey={transaction.iconKey} category={transaction.category} size={25} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 font-jakarta text-[18px] font-extrabold tracking-tight text-midnight">
          {transaction.title || transaction.desc}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-[12px] font-medium ${isIncome ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {isIncome ? 'Pemasukan' : 'Pengeluaran'}
          </span>
          <span className="text-[14px] font-medium text-muted">
            {[transaction.subtitle, transaction.time].filter(Boolean).join('  •  ')}
          </span>
        </div>
      </div>

      <div className="shrink-0 pr-4 text-right sm:pr-5">
        <p className={`font-jakarta text-[18px] font-bold tracking-tight ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>
          {isIncome ? '+' : '-'}{formatRupiah(transaction.amount)}
        </p>
      </div>
      <ChevronRight size={23} className="hidden shrink-0 text-muted sm:block" />
    </div>
  )
}
