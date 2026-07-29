import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, MessageCircleMore, Pencil, Search, SlidersHorizontal, Trash2, Undo2, X } from 'lucide-react'
import { TransactionIcon, WalletIcon } from '../shared/CategoryIcon'
import EditTransactionModal from './EditTransactionModal'

const DATE_FILTERS = [
  { id: 'all', label: 'Semua waktu' },
  { id: 'today', label: 'Hari ini' },
  { id: 'week', label: '7 hari' },
  { id: 'month', label: '30 hari' },
]

export default function HistoryView({
  transactions,
  wallets = [],
  categories = [],
  formatRupiah,
  onDeleteTransaction,
  onUpdateTransaction,
  onUndoLastTransaction,
  onNavigate,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [walletFilter, setWalletFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [editorTransaction, setEditorTransaction] = useState(null)
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  const lastUndoableTransaction = useMemo(
    () => transactions.find((transaction) => transaction.canDelete) || null,
    [transactions]
  )

  const filteredTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return transactions.filter((transaction) => {
      if (typeFilter !== 'all' && transaction.type !== typeFilter) {
        return false
      }

      if (walletFilter !== 'all' && transaction.walletId !== walletFilter) {
        return false
      }

      if (categoryFilter !== 'all' && transaction.categoryId !== categoryFilter) {
        return false
      }

      if (!matchesDateFilter(transaction.occurredAt, dateFilter)) {
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
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [categoryFilter, dateFilter, query, transactions, typeFilter, walletFilter])

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

  const summary = useMemo(() => {
    return transactions.reduce(
      (result, transaction) => {
        if (transaction.type === 'income') {
          result.incomeCount += 1
          result.totalIncome += Number(transaction.amount || 0)
        }

        if (transaction.type === 'expense') {
          result.expenseCount += 1
          result.totalExpense += Number(transaction.amount || 0)
        }

        if (transaction.canDelete) {
          result.deletableCount += 1
        }

        return result
      },
      {
        totalIncome: 0,
        totalExpense: 0,
        incomeCount: 0,
        expenseCount: 0,
        deletableCount: 0,
      }
    )
  }, [transactions])

  const showResetButton =
    query.trim() ||
    typeFilter !== 'all' ||
    walletFilter !== 'all' ||
    categoryFilter !== 'all' ||
    dateFilter !== 'all'

  const canLoadMore =
    hasMore &&
    !query.trim() &&
    typeFilter === 'all' &&
    walletFilter === 'all' &&
    categoryFilter === 'all' &&
    dateFilter === 'all'

  const resetFilters = () => {
    setQuery('')
    setTypeFilter('all')
    setWalletFilter('all')
    setCategoryFilter('all')
    setDateFilter('all')
  }

  return (
    <div className="page-view px-4 pb-7 pt-4 sm:px-6 lg:px-0 lg:pb-0 lg:pt-0">
      <div className="lg:hidden">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-jakarta text-[28px] font-extrabold tracking-tight text-midnight sm:text-[32px]">
              Histori
            </h2>
            <p className="text-[14px] font-semibold text-muted">{transactions.length} transaksi</p>
          </div>
          {lastUndoableTransaction ? (
            <button
              type="button"
              onClick={onUndoLastTransaction}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-midnight/10 bg-white px-3.5 font-jakarta text-[12px] font-bold text-midnight transition-colors hover:border-orange-200 hover:text-orange-700"
            >
              <Undo2 size={15} strokeWidth={2.2} />
              Undo
            </button>
          ) : null}
        </div>

        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_48px] gap-2">
          <SearchField query={query} onChange={setQuery} />
          <button
            type="button"
            aria-label="Filter lanjutan"
            aria-expanded={showMobileFilters}
            onClick={() => setShowMobileFilters((current) => !current)}
            className={`flex h-[52px] items-center justify-center rounded-[13px] border transition-colors ${
              showMobileFilters || walletFilter !== 'all' || categoryFilter !== 'all' || dateFilter !== 'all'
                ? 'border-gold accent-soft'
                : 'border-midnight/[0.08] bg-white text-muted'
            }`}
          >
            <SlidersHorizontal size={19} strokeWidth={2.1} />
          </button>
        </div>

        <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar">
          <FilterButton active={typeFilter === 'all'} label="Semua" onClick={() => setTypeFilter('all')} />
          <FilterButton
            active={typeFilter === 'income'}
            label="Masuk"
            icon={ArrowDown}
            onClick={() => setTypeFilter('income')}
          />
          <FilterButton
            active={typeFilter === 'expense'}
            label="Keluar"
            icon={ArrowUp}
            danger
            onClick={() => setTypeFilter('expense')}
          />
        </div>

        {showMobileFilters ? <div className="mb-5 grid gap-2 rounded-[16px] border border-midnight/[0.08] bg-white p-3 sm:grid-cols-3">
          <FilterSelect
            label="Dompet"
            value={walletFilter}
            onChange={setWalletFilter}
            options={[{ value: 'all', label: 'Semua dompet' }, ...wallets.map((wallet) => ({ value: wallet.id, label: wallet.name }))]}
          />
          <FilterSelect
            label="Kategori"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[{ value: 'all', label: 'Semua kategori' }, ...categories.map((category) => ({ value: category.id, label: category.name }))]}
          />
          <FilterSelect
            label="Waktu"
            value={dateFilter}
            onChange={setDateFilter}
            options={DATE_FILTERS.map((option) => ({ value: option.id, label: option.label }))}
          />
        </div> : null}

        <HistoryBody
          transactions={transactions}
          filteredTransactions={filteredTransactions}
          groupedTransactions={groupedTransactions}
          formatRupiah={formatRupiah}
          onDeleteTransaction={onDeleteTransaction}
          onEditTransaction={setEditorTransaction}
          onNavigate={onNavigate}
          onReset={resetFilters}
          canLoadMore={canLoadMore}
          loadingMore={loadingMore}
          onLoadMore={onLoadMore}
          mobile
        />
      </div>

      <div className="hidden lg:block">
        <section className="surface-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-jakarta text-[11px] font-extrabold  text-muted">
                Riwayat transaksi
              </p>
              <h2 className="mt-2 font-jakarta text-[28px] font-extrabold tracking-tight text-midnight">
                Histori
              </h2>
              <p className="mt-1 text-[13px] font-semibold text-muted">
                {filteredTransactions.length}
                {filteredTransactions.length !== transactions.length ? ` dari ${transactions.length}` : ''}
                {' '}transaksi
              </p>
            </div>

            <div className="flex w-full max-w-[520px] items-center gap-3">
              <div className="min-w-0 flex-1">
                <SearchField query={query} onChange={setQuery} desktop />
              </div>
              {lastUndoableTransaction ? (
                <button
                  type="button"
                  onClick={onUndoLastTransaction}
                  className="inline-flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-[16px] border border-midnight/10 bg-white px-4 font-jakarta text-[12px] font-bold text-midnight transition-colors hover:border-orange-200 hover:text-orange-700"
                >
                  <Undo2 size={16} strokeWidth={2.2} />
                  Undo terakhir
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-4">
            <DesktopHistoryStatCard label="Total" value={`${transactions.length}`} helper="transaksi" tone="slate" />
            <DesktopHistoryStatCard
              label="Masuk"
              value={formatRupiah(summary.totalIncome)}
              helper={`${summary.incomeCount} catatan`}
              tone="emerald"
            />
            <DesktopHistoryStatCard
              label="Keluar"
              value={formatRupiah(summary.totalExpense)}
              helper={`${summary.expenseCount} catatan`}
              tone="rose"
            />
            <DesktopHistoryStatCard
              label="Bisa koreksi"
              value={`${summary.deletableCount}`}
              helper="manual"
              tone="amber"
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <FilterButton active={typeFilter === 'all'} label="Semua" onClick={() => setTypeFilter('all')} desktop />
            <FilterButton
              active={typeFilter === 'income'}
              label="Masuk"
              icon={ArrowDown}
              onClick={() => setTypeFilter('income')}
              desktop
            />
            <FilterButton
              active={typeFilter === 'expense'}
              label="Keluar"
              icon={ArrowUp}
              danger
              onClick={() => setTypeFilter('expense')}
              desktop
            />
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px_auto]">
            <FilterSelect
              label="Dompet"
              value={walletFilter}
              onChange={setWalletFilter}
              options={[{ value: 'all', label: 'Semua dompet' }, ...wallets.map((wallet) => ({ value: wallet.id, label: wallet.name }))]}
              desktop
            />
            <FilterSelect
              label="Kategori"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[{ value: 'all', label: 'Semua kategori' }, ...categories.map((category) => ({ value: category.id, label: category.name }))]}
              desktop
            />
            <FilterSelect
              label="Waktu"
              value={dateFilter}
              onChange={setDateFilter}
              options={DATE_FILTERS.map((option) => ({ value: option.id, label: option.label }))}
              desktop
            />
            {showResetButton ? (
              <button
                type="button"
                onClick={resetFilters}
                className="self-end inline-flex h-[46px] items-center justify-center gap-2 rounded-[12px] border border-midnight/10 bg-white px-4 font-jakarta text-[12px] font-bold text-muted transition-colors hover:text-midnight"
              >
                <X size={15} strokeWidth={2.2} />
                Reset
              </button>
            ) : null}
          </div>
        </section>

        <section className="surface-card mt-5 overflow-hidden">
          <HistoryBody
            transactions={transactions}
            filteredTransactions={filteredTransactions}
            groupedTransactions={groupedTransactions}
            formatRupiah={formatRupiah}
            onDeleteTransaction={onDeleteTransaction}
            onEditTransaction={setEditorTransaction}
            onNavigate={onNavigate}
            onReset={resetFilters}
            canLoadMore={canLoadMore}
            loadingMore={loadingMore}
            onLoadMore={onLoadMore}
          />
        </section>
      </div>

      {editorTransaction ? (
        <EditTransactionModal
          transaction={editorTransaction}
          wallets={wallets}
          categories={categories}
          formatRupiah={formatRupiah}
          onClose={() => setEditorTransaction(null)}
          onSubmit={onUpdateTransaction}
        />
      ) : null}
    </div>
  )
}

function HistoryBody({
  transactions,
  filteredTransactions,
  groupedTransactions,
  formatRupiah,
  onDeleteTransaction,
  onEditTransaction,
  onNavigate,
  onReset,
  canLoadMore,
  loadingMore,
  onLoadMore,
  mobile = false,
}) {
  if (transactions.length === 0) {
    return mobile ? (
      <EmptyHistoryState onNavigate={onNavigate} />
    ) : (
      <div className="px-6 py-10">
        <EmptyHistoryState onNavigate={onNavigate} desktop />
      </div>
    )
  }

  if (filteredTransactions.length === 0) {
    return mobile ? (
      <NoHistoryResult onReset={onReset} />
    ) : (
      <div className="px-6 py-10">
        <NoHistoryResult onReset={onReset} desktop />
      </div>
    )
  }

  if (mobile) {
    return (
      <div className="space-y-6">
        {Object.entries(groupedTransactions).map(([dateLabel, items]) => (
          <section key={dateLabel}>
            <h3 className="mb-2.5 font-jakarta text-[16px] font-bold text-muted">{dateLabel}</h3>
            <div className="overflow-hidden rounded-[16px] border border-midnight/[0.08] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.025)]">
              {items.map((transaction) => (
                <MobileTransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  formatRupiah={formatRupiah}
                  onDeleteTransaction={onDeleteTransaction}
                  onEditTransaction={onEditTransaction}
                />
              ))}
            </div>
          </section>
        ))}

        {canLoadMore ? (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={onLoadMore}
              className="rounded-[12px] border border-midnight/[0.08] bg-white px-5 py-3 font-jakarta text-[13px] font-bold text-muted transition-colors hover:text-midnight"
            >
              {loadingMore ? 'Memuat...' : 'Muat lagi'}
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="divide-y divide-midnight/[0.06]">
      {Object.entries(groupedTransactions).map(([dateLabel, items]) => (
        <section key={dateLabel} className="px-5 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-jakarta text-[15px] font-extrabold tracking-tight text-midnight">
              {dateLabel}
            </h3>
            <span className="rounded-full bg-champagne px-3 py-1 text-[11px] font-bold text-muted">
              {items.length} transaksi
            </span>
          </div>

          <div className="overflow-hidden rounded-[16px] border border-midnight/[0.08]">
            <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1.1fr)_120px_150px_88px] gap-3 bg-champagne/70 px-4 py-3">
              <span className="font-jakarta text-[11px] font-extrabold  text-muted">
                Transaksi
              </span>
              <span className="font-jakarta text-[11px] font-extrabold  text-muted">
                Dompet
              </span>
              <span className="text-center font-jakarta text-[11px] font-extrabold  text-muted">
                Jenis
              </span>
              <span className="text-right font-jakarta text-[11px] font-extrabold  text-muted">
                Nominal
              </span>
              <span className="text-right font-jakarta text-[11px] font-extrabold  text-muted">
                Aksi
              </span>
            </div>

            {items.map((transaction) => (
              <DesktopTransactionRow
                key={transaction.id}
                transaction={transaction}
                formatRupiah={formatRupiah}
                onDeleteTransaction={onDeleteTransaction}
                onEditTransaction={onEditTransaction}
              />
            ))}
          </div>
        </section>
      ))}

      {canLoadMore ? (
        <div className="flex justify-center px-5 py-5">
          <button
            type="button"
            onClick={onLoadMore}
            className="rounded-full border border-midnight/[0.08] bg-white px-5 py-3 font-jakarta text-[12px] font-bold text-muted transition-colors hover:text-midnight"
          >
            {loadingMore ? 'Memuat...' : 'Muat lagi'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function SearchField({ query, onChange, desktop = false }) {
  return (
    <div
      className={`relative flex min-h-[52px] items-center rounded-[13px] border border-midnight/[0.08] bg-white p-1.5 ${
        desktop ? 'mb-0' : ''
      }`}
    >
      <div className="px-3 text-midnight/70">
        <Search size={22} strokeWidth={2} />
      </div>
      <input
        className="w-full border-none bg-transparent px-1 py-2.5 font-jakarta text-[14px] font-medium text-midnight outline-none placeholder:text-muted/70 focus:ring-0"
        placeholder="Cari transaksi, kategori, atau catatan"
        type="text"
        value={query}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function FilterButton({ active, label, icon: Icon, danger = false, onClick, desktop = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-[13px] border px-4 font-jakarta text-[13px] font-bold transition-all ${
        active
          ? 'border-orange-500 bg-orange-700 text-white'
          : 'border-midnight/10 bg-white text-midnight hover:border-orange-200'
      } ${desktop ? 'h-11 rounded-full px-4 text-[12px]' : ''}`}
    >
      {Icon ? (
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full border ${
            active
              ? 'border-white/70'
              : danger
                ? 'border-red-400 text-red-500'
                : 'border-orange-500 text-orange-600'
          }`}
        >
          <Icon size={14} strokeWidth={2.2} />
        </span>
      ) : null}
      {label}
    </button>
  )
}

function FilterSelect({ label, value, onChange, options, desktop = false }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className={`font-jakarta text-[11px] font-extrabold  text-muted ${desktop ? 'ml-1' : ''}`}>
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`min-w-0 rounded-[12px] border border-midnight/[0.08] bg-white px-3 py-3 font-jakarta text-[13px] font-semibold text-midnight outline-none transition-all focus:border-orange-300 focus:ring-2 focus:ring-orange-100 ${
          desktop ? 'h-[46px]' : ''
        }`}
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function EmptyHistoryState({ onNavigate, desktop = false }) {
  return (
    <div
      className={`rounded-[18px] border border-dashed border-midnight/15 bg-[var(--surface)] text-center ${
        desktop ? 'px-6 py-14' : 'px-5 py-10'
      }`}
    >
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-[15px] bg-[var(--accent-soft)] text-[var(--accent-ink)]">
        <MessageCircleMore size={21} strokeWidth={2.1} />
      </span>
      <p className="mt-3 font-jakarta text-[14px] font-bold text-midnight">Belum ada transaksi</p>
      <p className="mx-auto mt-1 max-w-[34ch] text-[12px] font-medium leading-relaxed text-muted">
        Ceritakan pemasukan atau pengeluaranmu. Kurogi akan menyusunnya ke histori.
      </p>
      <button
        type="button"
        onClick={() => onNavigate?.('chat')}
        className="mt-4 rounded-[13px] bg-orange-700 px-4 py-2.5 font-jakarta text-[12px] font-bold text-white transition-[background-color,transform] hover:bg-[var(--accent-hover)] active:scale-[0.98]"
      >
        Buka Chat
      </button>
    </div>
  )
}

function NoHistoryResult({ onReset, desktop = false }) {
  return (
    <div
      className={`rounded-[20px] border border-dashed border-midnight/15 bg-white text-center ${
        desktop ? 'px-6 py-12' : 'px-5 py-10'
      }`}
    >
      <p className="font-jakarta text-[13px] font-bold text-midnight">Tidak ditemukan.</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-4 rounded-full border border-midnight/10 bg-white px-4 py-2.5 font-jakarta text-[12px] font-bold text-midnight transition-colors hover:border-orange-200 hover:text-orange-700"
      >
        Tampilkan semua
      </button>
    </div>
  )
}

function MobileTransactionRow({ transaction, formatRupiah, onDeleteTransaction, onEditTransaction }) {
  const isIncome = transaction.type === 'income'

  return (
    <div className="group relative flex items-center gap-3 border-b border-midnight/8 px-3.5 py-3.5 last:border-b-0 sm:px-5">
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
          isIncome ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-500'
        }`}
      >
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
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
              isIncome ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-600'
            }`}
          >
            {isIncome ? 'Pemasukan' : 'Pengeluaran'}
          </span>
          <span className="text-[12px] font-medium text-muted">
            {[transaction.subtitle, transaction.time].filter(Boolean).join('  •  ')}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <p
          className={`max-w-[112px] truncate text-right font-jakarta text-[15px] font-bold tracking-tight sm:max-w-none sm:text-[16px] ${
            isIncome ? 'text-orange-600' : 'text-red-500'
          }`}
        >
          {isIncome ? '+' : '-'}
          {formatRupiah(transaction.amount)}
        </p>

        <div className="flex items-center gap-1">
          {transaction.canEdit ? (
            <button
              type="button"
              onClick={() => onEditTransaction(transaction)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-midnight/10 bg-white text-muted transition-colors hover:text-midnight"
              title="Koreksi"
              aria-label={`Koreksi ${transaction.title || transaction.desc}`}
            >
              <Pencil size={13} strokeWidth={2.2} />
            </button>
          ) : null}

          {transaction.canDelete ? (
            <button
              type="button"
              onClick={() => onDeleteTransaction(transaction.id)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-600 transition-colors hover:bg-red-100"
              title="Hapus transaksi"
              aria-label={`Hapus ${transaction.title || transaction.desc}`}
            >
              <Trash2 size={13} strokeWidth={2.2} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function DesktopTransactionRow({ transaction, formatRupiah, onDeleteTransaction, onEditTransaction }) {
  const isIncome = transaction.type === 'income'

  return (
    <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1.1fr)_120px_150px_88px] items-center gap-3 border-t border-midnight/[0.08] px-4 py-3 first:border-t-0">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
            isIncome ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-500'
          }`}
        >
          {transaction.wallet ? (
            <WalletIcon walletName={transaction.wallet} size={21} />
          ) : (
            <TransactionIcon iconKey={transaction.iconKey} category={transaction.category} size={20} />
          )}
        </div>

        <div className="min-w-0">
          <p className="truncate font-jakarta text-[14px] font-extrabold tracking-tight text-midnight">
            {transaction.title || transaction.desc}
          </p>
          <p className="mt-1 truncate text-[12px] font-medium text-muted">
            {[transaction.subtitle, transaction.time].filter(Boolean).join('  •  ')}
          </p>
        </div>
      </div>

      <div className="min-w-0">
        <p className="truncate font-jakarta text-[13px] font-bold text-midnight">{transaction.wallet}</p>
        <p className="mt-1 truncate text-[12px] font-medium text-muted">{transaction.category}</p>
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
            isIncome ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-600'
          }`}
        >
          {isIncome ? 'Masuk' : 'Keluar'}
        </span>
        <span className="text-[11px] font-semibold text-muted">{transaction.time}</span>
      </div>

      <div className="text-right">
        <p
          className={`font-jakarta text-[15px] font-extrabold tracking-tight ${
            isIncome ? 'text-orange-600' : 'text-red-500'
          }`}
        >
          {isIncome ? '+' : '-'}
          {formatRupiah(transaction.amount)}
        </p>
      </div>

      <div className="flex justify-end gap-1.5">
        {transaction.canEdit ? (
          <button
            type="button"
            onClick={() => onEditTransaction(transaction)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-midnight/10 bg-white text-muted transition-colors hover:text-midnight"
            aria-label={`Koreksi ${transaction.title || transaction.desc}`}
            title="Koreksi"
          >
            <Pencil size={15} strokeWidth={2.1} />
          </button>
        ) : null}

        {transaction.canDelete ? (
          <button
            type="button"
            onClick={() => onDeleteTransaction(transaction.id)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-600 transition-colors hover:bg-red-100"
            aria-label={`Hapus ${transaction.title || transaction.desc}`}
            title="Hapus"
          >
            <Trash2 size={15} strokeWidth={2.1} />
          </button>
        ) : null}

        {!transaction.canEdit && !transaction.canDelete ? <span className="h-9 w-9" aria-hidden="true" /> : null}
      </div>
    </div>
  )
}

function DesktopHistoryStatCard({ label, value, helper, tone = 'slate' }) {
  const toneClass = {
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    emerald: 'border-orange-100 bg-orange-50 text-orange-700',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  }[tone] || 'border-slate-200 bg-slate-50 text-slate-700'

  return (
    <div className={`rounded-[16px] border p-4 ${toneClass}`}>
      <p className="font-jakarta text-[11px] font-extrabold  opacity-75">
        {label}
      </p>
      <p className="mt-3 font-jakarta text-[24px] font-extrabold tracking-tight">{value}</p>
      <p className="mt-1 text-[12px] font-semibold opacity-80">{helper}</p>
    </div>
  )
}

function matchesDateFilter(value, filterId) {
  if (filterId === 'all') {
    return true
  }

  const occurredAt = new Date(value)
  if (Number.isNaN(occurredAt.getTime())) {
    return true
  }

  const now = new Date()
  const diffMs = now.getTime() - occurredAt.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (filterId === 'today') {
    return occurredAt.toDateString() === now.toDateString()
  }

  if (filterId === 'week') {
    return diffDays <= 7
  }

  if (filterId === 'month') {
    return diffDays <= 30
  }

  return true
}
