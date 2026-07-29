import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  Info,
  Pencil,
  Plus,
  SlidersHorizontal,
  Target,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import { WalletIcon } from '../shared/CategoryIcon'
import AddWalletModal from './AddWalletModal'
import AddGoalModal from './AddGoalModal'
import RenameEntityModal from '../shared/RenameEntityModal'

const WALLET_FILTERS = [
  { id: 'all', label: 'Semua' },
  { id: 'cash', label: 'Tunai' },
  { id: 'bank', label: 'Bank' },
  { id: 'e_wallet', label: 'E-Wallet' },
]

const WALLET_TYPE_META = {
  cash: {
    label: 'Tunai',
    description: 'Dompet tunai',
    badgeClass: 'bg-orange-50 text-orange-700',
    iconClass: 'from-orange-50 to-[var(--surface-strong)] text-orange-600 ring-orange-100/80',
    accentClass: 'bg-orange-700',
  },
  bank: {
    label: 'Bank',
    description: 'Rekening bank',
    badgeClass: 'bg-sky-50 text-sky-700',
    iconClass: 'from-sky-50 to-[var(--surface-strong)] text-sky-600 ring-sky-100/80',
    accentClass: 'bg-sky-500',
  },
  e_wallet: {
    label: 'E-Wallet',
    description: 'Saldo e-wallet',
    badgeClass: 'bg-blue-50 text-blue-700',
    iconClass: 'from-blue-50 to-[var(--surface-strong)] text-blue-600 ring-blue-100/80',
    accentClass: 'bg-blue-500',
  },
  savings: {
    label: 'Tabungan',
    description: 'Tabungan',
    badgeClass: 'bg-amber-50 text-amber-700',
    iconClass: 'from-amber-50 to-[var(--surface-strong)] text-amber-600 ring-amber-100/80',
    accentClass: 'bg-amber-500',
  },
  investment: {
    label: 'Investasi',
    description: 'Investasi',
    badgeClass: 'bg-violet-50 text-violet-700',
    iconClass: 'from-violet-50 to-[var(--surface-strong)] text-violet-600 ring-violet-100/80',
    accentClass: 'bg-violet-500',
  },
  goal: {
    label: 'Target',
    description: 'Dompet target',
    badgeClass: 'bg-teal-50 text-teal-700',
    iconClass: 'from-teal-50 to-[var(--surface-strong)] text-teal-600 ring-teal-100/80',
    accentClass: 'bg-teal-500',
  },
  default: {
    label: 'Dompet',
    description: 'Dompet aktif',
    badgeClass: 'bg-slate-100 text-slate-700',
    iconClass: 'from-slate-50 to-[var(--surface-strong)] text-slate-600 ring-slate-100',
    accentClass: 'bg-slate-400',
  },
}

function formatWalletBalance(value) {
  return Number(value || 0)
}

function normalizeWalletType(walletType) {
  const normalized = String(walletType || '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

  if (normalized === 'ewallet') return 'e_wallet'
  if (normalized === 'tunai') return 'cash'
  if (normalized === 'rekening') return 'bank'

  return normalized || 'default'
}

function getWalletMeta(wallet) {
  const normalizedType = normalizeWalletType(wallet?.wallet_type)
  const meta = WALLET_TYPE_META[normalizedType] || WALLET_TYPE_META.default

  return {
    ...meta,
    type: normalizedType,
  }
}

function getWalletDescription(wallet, meta) {
  if (meta.type === 'bank') return `Rekening ${wallet.name}`
  if (meta.type === 'e_wallet') return `Saldo ${wallet.name}`
  return meta.description
}

function walletMatchesFilter(wallet, filterId) {
  if (filterId === 'all') return true
  return getWalletMeta(wallet).type === filterId
}

export default function WalletsView({
  wallets,
  goals = [],
  conflicts = { wallets: [], goals: [] },
  onAddWallet,
  onDeleteWallet,
  onRenameWallet,
  onAddGoal,
  onDeleteGoal,
  onRenameGoal,
  formatRupiah,
}) {
  const [showAddWallet, setShowAddWallet] = useState(false)
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [renameDialog, setRenameDialog] = useState(null)
  const [activeWalletFilter, setActiveWalletFilter] = useState('all')
  const [manageMode, setManageMode] = useState(false)

  const hasConflicts = conflicts.wallets.length > 0 || conflicts.goals.length > 0
  const activeWalletCount = wallets.length
  const fundedGoalsCount = goals.filter((goal) => Number(goal.current_amount || 0) > 0).length
  const activeFilterLabel = WALLET_FILTERS.find((filter) => filter.id === activeWalletFilter)?.label || 'Dompet'
  const totalWalletBalance = wallets.reduce((sum, wallet) => sum + Number(wallet.current_balance || 0), 0)
  const filteredWallets = useMemo(
    () => wallets.filter((wallet) => walletMatchesFilter(wallet, activeWalletFilter)),
    [activeWalletFilter, wallets]
  )
  const filteredWalletBalance = filteredWallets.reduce(
    (sum, wallet) => sum + Number(wallet.current_balance || 0),
    0
  )

  const handleRenameWallet = (wallet) => {
    setRenameDialog({
      type: 'wallet',
      id: wallet.id,
      initialValue: wallet.name,
      title: 'Ubah Dompet',
      subtitle: '',
      label: 'Nama Dompet',
      placeholder: 'Contoh: BCA',
      submitLabel: 'Simpan',
    })
  }

  const handleRenameGoal = (goal) => {
    setRenameDialog({
      type: 'goal',
      id: goal.id,
      initialValue: goal.name,
      title: 'Ubah Target',
      subtitle: '',
      label: 'Nama Target',
      placeholder: 'Contoh: Dana Darurat',
      submitLabel: 'Simpan',
    })
  }

  const handleRenameSubmit = async (nextName) => {
    if (!renameDialog) {
      return { error: new Error('Tidak ada item yang sedang diubah.') }
    }

    if (renameDialog.type === 'wallet') {
      return onRenameWallet(renameDialog.id, nextName)
    }

    return onRenameGoal(renameDialog.id, nextName)
  }

  return (
    <div className="page-view min-w-0 overflow-x-hidden px-4 pb-7 pt-4 sm:px-6 lg:px-0 lg:pb-0 lg:pt-0">
      {hasConflicts ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-amber-100 p-2 text-amber-700">
              <AlertTriangle size={16} />
            </div>
            <div className="min-w-0">
              <p className="font-jakarta text-[11px] font-extrabold  text-amber-800">
                Nama bentrok
              </p>
              <div className="mt-1 space-y-1 text-[12px] font-semibold text-amber-900/80">
                {conflicts.wallets.map((conflict) => (
                  <p key={`wallet-${conflict.normalizedName}`}>
                    Dompet: {conflict.items.map((item) => item.name).join(', ')}
                  </p>
                ))}
                {conflicts.goals.map((conflict) => (
                  <p key={`goal-${conflict.normalizedName}`}>
                    Target: {conflict.items.map((item) => item.name).join(', ')}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="lg:hidden">
        <section className="mb-7 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-jakarta text-[28px] font-extrabold leading-tight tracking-tight text-midnight sm:text-[30px]">
                Dompet
              </h2>
              <p className="mt-1 text-[13px] font-semibold text-muted sm:text-[14px]">
                {activeWalletCount} dompet aktif
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddWallet(true)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-midnight/10 bg-white text-orange-600 shadow-sm transition-all hover:border-orange-200 hover:bg-orange-50"
                aria-label="Tambah dompet"
                title="Tambah dompet"
              >
                <Plus size={18} strokeWidth={2.4} />
              </button>
              <button
                type="button"
                onClick={() => setManageMode((current) => !current)}
                aria-pressed={manageMode}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-full border px-3.5 font-jakarta text-[13px] font-bold transition-all ${
                  manageMode
                    ? 'border-orange-200 bg-orange-50 text-orange-700'
                    : 'border-transparent bg-white text-orange-600 hover:bg-orange-50'
                }`}
              >
                <SlidersHorizontal size={17} strokeWidth={2.3} />
                Kelola
              </button>
            </div>
          </div>

          <div className="no-scrollbar -mx-4 mt-5 flex max-w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-1">
            {WALLET_FILTERS.map((filter) => {
              const isActive = activeWalletFilter === filter.id

              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveWalletFilter(filter.id)}
                  className={`h-11 shrink-0 rounded-full border px-5 font-jakarta text-[13px] font-bold transition-all sm:min-w-[118px] sm:text-[14px] ${
                    isActive
                      ? 'border-gold accent-soft'
                      : 'border-midnight/10 bg-white text-muted hover:border-midnight/20 hover:text-midnight'
                  }`}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>

          <div className="mt-4 space-y-3">
            {wallets.length === 0 ? (
              <EmptyWalletCard onAdd={() => setShowAddWallet(true)} />
            ) : filteredWallets.length > 0 ? (
              filteredWallets.map((wallet, index) => (
                <WalletListItem
                  key={wallet.id}
                  wallet={wallet}
                  featured={activeWalletFilter === 'all' && index === 0}
                  formatRupiah={formatRupiah}
                  manageMode={manageMode}
                  onRename={() => handleRenameWallet(wallet)}
                  onDelete={() => onDeleteWallet(wallet.id)}
                />
              ))
            ) : (
              <FilteredWalletEmpty
                filterLabel={activeFilterLabel}
                onAdd={() => setShowAddWallet(true)}
              />
            )}
          </div>

          <div className="mt-4 flex items-start gap-2.5 px-1 text-muted">
            <Info size={16} className="mt-0.5 shrink-0 text-gold" strokeWidth={2.2} />
            <p className="min-w-0 text-[11px] font-medium leading-relaxed sm:text-[12px]">
              Menghapus dompet juga menghapus riwayat transaksi yang terkait.
            </p>
          </div>
        </section>

        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-jakarta text-[22px] font-extrabold tracking-tight text-midnight sm:text-[24px]">
              Target
            </h2>
            <p className="mt-1 text-[13px] font-semibold text-muted">
              {fundedGoalsCount}/{goals.length || 0} target berjalan
            </p>
          </div>
          <button
            onClick={() => setShowAddGoal(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-midnight/10 bg-white px-4 font-jakarta text-[13px] font-bold text-orange-600 shadow-sm transition-all hover:bg-orange-50"
          >
            <Plus size={15} strokeWidth={2.4} />
            Target
          </button>
        </div>

        {goals.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {goals.map((goal) => (
              <MobileGoalCard
                key={goal.id}
                goal={goal}
                formatRupiah={formatRupiah}
                onRename={() => handleRenameGoal(goal)}
                onDelete={() => onDeleteGoal(goal.id)}
              />
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddGoal(true)}
            className="flex w-full items-center justify-center gap-3 rounded-[16px] border border-dashed border-midnight/20 bg-white px-5 py-7 text-center transition-all hover:border-gold"
          >
            <Target size={20} className="text-muted" />
            <span className="font-jakarta text-[12px] font-extrabold  text-midnight">
              Buat target
            </span>
          </button>
        )}
      </div>

      <div className="hidden lg:block">
        <section className="surface-card mb-5 grid overflow-hidden lg:grid-cols-[1.5fr_1fr_1fr]">
          <div className="bg-[var(--accent-soft)] px-6 py-5">
            <p className="font-jakarta text-[11px] font-bold text-[var(--accent-ink)]">Saldo aktif</p>
            <p className="money-number mt-2 text-[32px] font-bold text-midnight">{formatRupiah(totalWalletBalance)}</p>
            <p className="mt-1 text-[12px] font-medium text-muted">{activeWalletCount} dompet aktif</p>
          </div>
          <div className="border-t border-midnight/[0.07] px-6 py-5 lg:border-l lg:border-t-0">
            <p className="text-[11px] font-bold text-muted">Filter aktif</p>
            <p className="money-number mt-2 text-[21px] font-bold text-midnight">{formatRupiah(filteredWalletBalance)}</p>
            <p className="mt-1 text-[12px] font-medium text-muted">{activeFilterLabel}</p>
          </div>
          <div className="border-t border-midnight/[0.07] px-6 py-5 lg:border-l lg:border-t-0">
            <p className="text-[11px] font-bold text-muted">Target berjalan</p>
            <p className="mt-2 font-jakarta text-[21px] font-bold text-midnight">{fundedGoalsCount}/{goals.length || 0}</p>
            <p className="mt-1 text-[12px] font-medium text-muted">{goals.length > 0 ? 'sudah terisi' : 'belum dibuat'}</p>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
          <section className="surface-card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-jakarta text-[11px] font-extrabold  text-muted">
                  Struktur dana
                </p>
                <h2 className="mt-2 font-jakarta text-[28px] font-extrabold tracking-tight text-midnight">
                  Dompet
                </h2>
                <p className="mt-1 text-[13px] font-semibold text-muted">
                  {filteredWallets.length}
                  {filteredWallets.length !== wallets.length ? ` dari ${wallets.length}` : ''}
                  {' '}dompet
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setManageMode((current) => !current)}
                  aria-pressed={manageMode}
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-full border px-4 font-jakarta text-[13px] font-bold transition-all ${
                    manageMode
                      ? 'border-orange-200 bg-orange-50 text-orange-700'
                      : 'border-midnight/10 bg-white text-midnight hover:border-orange-200 hover:text-orange-700'
                  }`}
                >
                  <SlidersHorizontal size={17} strokeWidth={2.2} />
                  {manageMode ? 'Selesai' : 'Kelola'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddWallet(true)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-orange-700 px-4 font-jakarta text-[13px] font-bold text-white transition-all hover:bg-orange-700"
                >
                  <Plus size={16} strokeWidth={2.5} />
                  Tambah dompet
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-[16px] border border-midnight/[0.08] bg-champagne/55 p-2">
              <div className="flex flex-wrap gap-2">
                {WALLET_FILTERS.map((filter) => {
                  const isActive = activeWalletFilter === filter.id

                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setActiveWalletFilter(filter.id)}
                      className={`inline-flex h-10 items-center justify-center rounded-full px-4 font-jakarta text-[13px] font-bold transition-all ${
                        isActive
                          ? 'bg-white text-midnight shadow-sm'
                          : 'text-muted hover:text-midnight'
                      }`}
                    >
                      {filter.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-5">
              {wallets.length === 0 ? (
                <EmptyWalletCard onAdd={() => setShowAddWallet(true)} />
              ) : filteredWallets.length > 0 ? (
                <div className="overflow-hidden rounded-[16px] border border-midnight/[0.08]">
                  <div className="grid grid-cols-[minmax(0,1.8fr)_130px_170px_88px] gap-4 bg-champagne/70 px-4 py-3">
                    <span className="font-jakarta text-[11px] font-extrabold  text-muted">
                      Dompet
                    </span>
                    <span className="font-jakarta text-[11px] font-extrabold  text-muted">
                      Tipe
                    </span>
                    <span className="text-right font-jakarta text-[11px] font-extrabold  text-muted">
                      Saldo
                    </span>
                    <span className="text-right font-jakarta text-[11px] font-extrabold  text-muted">
                      Aksi
                    </span>
                  </div>

                  {filteredWallets.map((wallet, index) => (
                    <DesktopWalletRow
                      key={wallet.id}
                      wallet={wallet}
                      featured={activeWalletFilter === 'all' && index === 0}
                      formatRupiah={formatRupiah}
                      manageMode={manageMode}
                      onRename={() => handleRenameWallet(wallet)}
                      onDelete={() => onDeleteWallet(wallet.id)}
                    />
                  ))}
                </div>
              ) : (
                <FilteredWalletEmpty
                  filterLabel={activeFilterLabel}
                  onAdd={() => setShowAddWallet(true)}
                />
              )}
            </div>
          </section>

          <aside className="space-y-5">
            <section className="surface-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-jakarta text-[11px] font-extrabold  text-muted">
                    Target
                  </p>
                  <h3 className="mt-2 font-jakarta text-[24px] font-extrabold tracking-tight text-midnight">Simpanan</h3>
                </div>
                <button
                  onClick={() => setShowAddGoal(true)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-midnight/10 bg-white px-4 font-jakarta text-[13px] font-bold text-orange-600 transition-all hover:bg-orange-50"
                >
                  <Plus size={15} strokeWidth={2.4} />
                  Target
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {goals.length > 0 ? (
                  goals.map((goal) => (
                    <DesktopGoalCard
                      key={goal.id}
                      goal={goal}
                      formatRupiah={formatRupiah}
                      onRename={() => handleRenameGoal(goal)}
                      onDelete={() => onDeleteGoal(goal.id)}
                    />
                  ))
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddGoal(true)}
                    className="flex w-full items-center justify-center gap-3 rounded-[16px] border border-dashed border-midnight/20 bg-champagne/45 px-5 py-8 text-center transition-all hover:border-midnight/30 hover:bg-champagne/65"
                  >
                    <Target size={20} className="text-muted" />
                    <span className="font-jakarta text-[13px] font-extrabold text-midnight">
                      Buat target pertama
                    </span>
                  </button>
                )}
              </div>
            </section>

          </aside>
        </div>
      </div>

      {showAddWallet && (
        <AddWalletModal
          onClose={() => setShowAddWallet(false)}
          onSubmit={onAddWallet}
        />
      )}

      {showAddGoal && (
        <AddGoalModal
          onClose={() => setShowAddGoal(false)}
          onSubmit={onAddGoal}
        />
      )}

      {renameDialog ? (
        <RenameEntityModal
          title={renameDialog.title}
          subtitle={renameDialog.subtitle}
          label={renameDialog.label}
          placeholder={renameDialog.placeholder}
          initialValue={renameDialog.initialValue}
          submitLabel={renameDialog.submitLabel}
          onClose={() => setRenameDialog(null)}
          onSubmit={handleRenameSubmit}
        />
      ) : null}
    </div>
  )
}

function WalletListItem({ wallet, formatRupiah, featured, manageMode, onRename, onDelete }) {
  const balance = formatWalletBalance(wallet.current_balance)
  const meta = getWalletMeta(wallet)

  return (
    <div className="group relative overflow-visible rounded-[16px] border border-midnight/[0.08] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.025)] transition-all hover:border-orange-200">
      {featured ? (
        <span className={`absolute left-0 top-4 h-[calc(100%-2rem)] w-1 rounded-r-full ${meta.accentClass}`} />
      ) : null}

      <div className="grid min-h-[96px] grid-cols-[54px_minmax(0,1fr)_minmax(108px,auto)] items-center gap-3 px-3 py-3 sm:min-h-[104px] sm:grid-cols-[64px_minmax(0,1fr)_minmax(146px,auto)] sm:gap-4 sm:px-4">
        <div className={`flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br ring-1 ${meta.iconClass} sm:h-[64px] sm:w-[64px] sm:rounded-[16px]`}>
          <WalletIcon walletName={wallet.name} size={31} strokeWidth={2.15} />
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate font-jakarta text-[16px] font-extrabold leading-tight tracking-tight text-midnight sm:text-[18px]">
              {wallet.name}
            </h3>
            <span className={`shrink-0 rounded-full px-2.5 py-1 font-jakarta text-[10px] font-extrabold leading-none ${meta.badgeClass} sm:text-[11px]`}>
              {meta.label}
            </span>
          </div>
          <p className="mt-1.5 truncate text-[12px] font-medium text-muted sm:text-[14px]">
            {getWalletDescription(wallet, meta)}
          </p>
        </div>

        <div className="flex min-w-0 flex-col items-end gap-2 text-right">
          <p className="max-w-[116px] truncate font-jakarta text-[15px] font-extrabold tracking-tight text-midnight sm:max-w-[166px] sm:text-[18px]">
            {formatRupiah(balance)}
          </p>
          {manageMode ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onRename}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-midnight/10 bg-white text-muted shadow-sm transition-all hover:border-midnight/20 hover:text-midnight"
                aria-label={`Ubah ${wallet.name}`}
                title="Ubah"
              >
                <Pencil size={15} strokeWidth={2.1} />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-600 shadow-sm transition-all hover:bg-red-100"
                aria-label={`Hapus ${wallet.name}`}
                title="Hapus"
              >
                <Trash2 size={15} strokeWidth={2.1} />
              </button>
            </div>
          ) : (
            <WalletActionMenu walletName={wallet.name} onRename={onRename} onDelete={onDelete} />
          )}
        </div>
      </div>
    </div>
  )
}

function DesktopWalletRow({ wallet, formatRupiah, featured, manageMode, onRename, onDelete }) {
  const balance = formatWalletBalance(wallet.current_balance)
  const meta = getWalletMeta(wallet)

  return (
    <div className="grid grid-cols-[minmax(0,1.8fr)_130px_170px_88px] items-center gap-4 border-t border-midnight/[0.08] px-4 py-3 first:border-t-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative shrink-0">
          {featured ? (
            <span className={`absolute -left-3 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full ${meta.accentClass}`} />
          ) : null}
          <div className={`flex h-12 w-12 items-center justify-center rounded-[16px] bg-gradient-to-br ring-1 ${meta.iconClass}`}>
            <WalletIcon walletName={wallet.name} size={24} strokeWidth={2.1} />
          </div>
        </div>

        <div className="min-w-0">
          <p className="truncate font-jakarta text-[15px] font-extrabold tracking-tight text-midnight">
            {wallet.name}
          </p>
          <p className="mt-1 truncate text-[12px] font-medium text-muted">
            {getWalletDescription(wallet, meta)}
          </p>
        </div>
      </div>

      <div>
        <span className={`inline-flex rounded-full px-2.5 py-1 font-jakarta text-[10px] font-extrabold ${meta.badgeClass}`}>
          {meta.label}
        </span>
      </div>

      <div className="text-right">
        <p className="font-jakarta text-[18px] font-extrabold tracking-tight text-midnight">
          {formatRupiah(balance)}
        </p>
      </div>

      <div className="flex justify-end">
        {manageMode ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onRename}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-midnight/10 bg-white text-muted transition-all hover:border-midnight/20 hover:text-midnight"
              aria-label={`Ubah ${wallet.name}`}
              title="Ubah"
            >
              <Pencil size={15} strokeWidth={2.1} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-600 transition-all hover:bg-red-100"
              aria-label={`Hapus ${wallet.name}`}
              title="Hapus"
            >
              <Trash2 size={15} strokeWidth={2.1} />
            </button>
          </div>
        ) : (
          <WalletActionMenu walletName={wallet.name} onRename={onRename} onDelete={onDelete} compact />
        )}
      </div>
    </div>
  )
}

function WalletActionMenu({ walletName, onRename, onDelete, compact = false }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const menuId = useId()

  useLayoutEffect(() => {
    if (!menuOpen) {
      return undefined
    }

    const updateMenuPosition = () => {
      const button = buttonRef.current
      const menu = menuRef.current

      if (!button || !menu) return

      const buttonRect = button.getBoundingClientRect()
      const menuWidth = menu.offsetWidth
      const menuHeight = menu.offsetHeight
      const viewportPadding = 12
      const gap = 8
      const left = Math.min(
        window.innerWidth - menuWidth - viewportPadding,
        Math.max(viewportPadding, buttonRect.right - menuWidth),
      )
      const hasRoomBelow = buttonRect.bottom + gap + menuHeight <= window.innerHeight - viewportPadding
      const top = hasRoomBelow
        ? buttonRect.bottom + gap
        : Math.max(viewportPadding, buttonRect.top - menuHeight - gap)

      setMenuPosition({ left, top })
    }

    updateMenuPosition()
    const handleScroll = () => setMenuOpen(false)
    window.addEventListener('resize', updateMenuPosition)
    document.addEventListener('scroll', handleScroll, true)

    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (
        !buttonRef.current?.contains(event.target)
        && !menuRef.current?.contains(event.target)
      ) {
        setMenuOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const handleRenameClick = () => {
    setMenuOpen(false)
    onRename()
  }

  const handleDeleteClick = () => {
    setMenuOpen(false)
    onDelete()
  }

  const handleMenuToggle = () => {
    if (!menuOpen) setMenuPosition(null)
    setMenuOpen((open) => !open)
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleMenuToggle}
        className={`flex items-center justify-center rounded-full bg-slate-50 text-midnight transition-all hover:bg-orange-50 hover:text-orange-700 ${
          compact ? 'h-10 w-10' : 'h-11 w-11'
        }`}
        aria-label={`Aksi untuk ${walletName}`}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-controls={menuOpen ? menuId : undefined}
      >
        <ChevronRight size={18} strokeWidth={2.3} />
      </button>

      {menuOpen ? createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`Aksi untuk ${walletName}`}
          style={{ left: menuPosition?.left ?? 0, top: menuPosition?.top ?? 0 }}
          className={`fixed z-[110] w-36 overflow-hidden rounded-[12px] border border-midnight/10 bg-white p-1.5 text-left shadow-[0_14px_34px_rgba(15,23,42,0.16)] ${
            menuPosition ? 'visible animate-scale-in' : 'invisible'
          }`}
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleRenameClick}
            className="flex min-h-11 w-full items-center gap-2 rounded-[12px] px-3 py-2.5 text-[14px] font-semibold text-midnight transition-colors hover:bg-slate-50"
          >
            <Pencil size={15} />
            Ubah
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleDeleteClick}
            className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-[12px] px-3 py-2.5 text-[14px] font-semibold text-red-600 transition-colors hover:bg-red-50"
          >
            <Trash2 size={15} />
            Hapus
          </button>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}

function MobileGoalCard({ goal, formatRupiah, onRename, onDelete }) {
  const progress = Math.min(100, (goal.current_amount / goal.target_amount) * 100)
  const remainingAmount = Math.max(Number(goal.target_amount || 0) - Number(goal.current_amount || 0), 0)

  return (
    <div className="rounded-[16px] border border-midnight/10 bg-white p-4 shadow-sm transition-all hover:border-orange-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600 sm:h-14 sm:w-14">
            <Target size={24} strokeWidth={2.1} />
          </div>
          <div className="min-w-0">
            <h4 className="truncate font-jakarta text-[17px] font-extrabold tracking-tight text-midnight sm:text-[18px]">
              {goal.name}
            </h4>
            <p className="mt-1 text-[13px] font-medium leading-relaxed text-muted sm:text-[14px]">
              Terkumpul {formatRupiah(goal.current_amount)} dari {formatRupiah(goal.target_amount)}
            </p>
          </div>
        </div>

        <span className="font-jakarta text-[20px] font-extrabold text-orange-600">
          {Math.round(progress)}%
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-muted">
          <span className="inline-flex items-center gap-2"><Calendar size={14} /> Target</span>
          <span>Sisa {formatRupiah(remainingAmount)}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-midnight/10">
          <div
            className="h-full rounded-full bg-orange-700 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={onRename}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-midnight/10 bg-white px-3 py-2.5 font-jakarta text-[11px] font-extrabold  text-muted transition-all hover:border-midnight/20 hover:text-midnight"
          title="Ubah target"
        >
          <Pencil size={14} strokeWidth={2.1} />
          Ubah
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 font-jakarta text-[11px] font-extrabold  text-red-600 transition-all hover:bg-red-100"
        >
          <X size={15} strokeWidth={2.1} />
          Hapus
        </button>
      </div>
    </div>
  )
}

function DesktopGoalCard({ goal, formatRupiah, onRename, onDelete }) {
  const progress = Math.min(100, (goal.current_amount / goal.target_amount) * 100)
  const remainingAmount = Math.max(Number(goal.target_amount || 0) - Number(goal.current_amount || 0), 0)

  return (
    <div className="rounded-[16px] border border-midnight/[0.08] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate font-jakarta text-[17px] font-extrabold tracking-tight text-midnight">
            {goal.name}
          </h4>
          <p className="mt-1 text-[13px] font-medium text-muted">
            Terkumpul {formatRupiah(goal.current_amount)}
          </p>
        </div>
        <span className="font-jakarta text-[18px] font-extrabold text-orange-600">
          {Math.round(progress)}%
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-3 text-[12px] font-semibold text-muted">
          <span>Target {formatRupiah(goal.target_amount)}</span>
          <span>Sisa {formatRupiah(remainingAmount)}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-midnight/10">
          <div
            className="h-full rounded-full bg-orange-700 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={onRename}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-midnight/10 bg-white text-muted transition-all hover:border-midnight/20 hover:text-midnight"
          title="Ubah target"
          aria-label={`Ubah ${goal.name}`}
        >
          <Pencil size={14} strokeWidth={2.1} />
        </button>
        <button
          onClick={onDelete}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-600 transition-all hover:bg-red-100"
          title="Hapus target"
          aria-label={`Hapus ${goal.name}`}
        >
          <X size={15} strokeWidth={2.1} />
        </button>
      </div>
    </div>
  )
}

function EmptyWalletCard({ onAdd }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex w-full items-center gap-3 rounded-[16px] border border-dashed border-midnight/15 bg-white px-4 py-5 text-left transition-colors hover:border-orange-200 hover:bg-orange-50/40"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-orange-50 text-orange-600">
        <Plus size={24} strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <span className="block font-jakarta text-[16px] font-extrabold text-midnight">Tambah dompet</span>
        <span className="mt-1 block text-[13px] font-medium text-muted">Mulai dari dompet utama kamu.</span>
      </span>
    </button>
  )
}

function FilteredWalletEmpty({ filterLabel, onAdd }) {
  return (
    <div className="rounded-[16px] border border-dashed border-midnight/15 bg-slate-50/70 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-jakarta text-[15px] font-extrabold text-midnight">
            Belum ada {filterLabel.toLowerCase()}
          </p>
          <p className="mt-1 text-[13px] font-medium text-muted">
            Tambahkan dompet baru atau pilih kategori lain.
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-700 text-white shadow-sm transition-all hover:bg-orange-700"
          aria-label="Tambah dompet"
        >
          <Plus size={18} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  )
}
