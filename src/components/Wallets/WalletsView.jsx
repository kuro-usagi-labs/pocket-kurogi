import { createElement, useEffect, useRef, useState } from 'react'
import { Calendar, Info, MoreHorizontal, Plus, Target, Trash2, Pencil, AlertTriangle, Wallet, X } from 'lucide-react'
import { WalletIcon } from '../shared/CategoryIcon'
import AddWalletModal from './AddWalletModal'
import AddGoalModal from './AddGoalModal'
import RenameEntityModal from '../shared/RenameEntityModal'

function formatWalletBalance(value) {
  return Number(value || 0)
}

function formatWalletTypeLabel(walletType) {
  const normalized = String(walletType || '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

  if (normalized === 'bank') return 'Dompet bank'
  if (normalized === 'cash') return 'Dompet tunai'
  if (normalized === 'e_wallet' || normalized === 'ewallet') return 'Dompet e-wallet'
  if (normalized === 'savings') return 'Tabungan'
  if (normalized === 'investment') return 'Investasi'
  if (normalized === 'goal') return 'Dompet target'

  return normalized ? `Dompet ${normalized.replace(/_/g, ' ')}` : 'Dompet aktif'
}

export default function WalletsView({
  wallets,
  totalBalance,
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

  const hasConflicts = conflicts.wallets.length > 0 || conflicts.goals.length > 0
  const activeWalletCount = wallets.length
  const fundedGoalsCount = goals.filter((goal) => Number(goal.current_amount || 0) > 0).length

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
    <div className="mx-auto max-w-5xl px-5 pb-8 pt-3 sm:px-8 lg:px-10">
      {hasConflicts ? (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-amber-100 p-2 text-amber-700">
              <AlertTriangle size={16} />
            </div>
            <div className="min-w-0">
              <p className="font-jakarta text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-800">
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

      <div className="mb-7 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-jakarta text-[34px] font-extrabold tracking-tight text-midnight sm:text-[42px]">Dompet</h2>
          <p className="mt-2 text-[17px] font-medium text-muted">Kelola saldo dan target keuanganmu.</p>
        </div>
        <button
          onClick={() => setShowAddWallet(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[16px] bg-emerald-500 px-4 py-3 font-jakarta text-[15px] font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 active:scale-[0.98] sm:px-7 sm:py-4 sm:text-[18px]"
        >
          <Plus size={22} strokeWidth={2.4} />
          <span className="hidden sm:inline">Tambah dompet</span>
          <span className="sm:hidden">Tambah</span>
        </button>
      </div>

      <section className="mb-5 rounded-[22px] border border-midnight/10 bg-white p-5 shadow-[0_14px_38px_rgba(15,23,42,0.05)] sm:p-7">
        <div className="flex flex-col gap-5">
          <div>
            <p className="font-jakarta text-[18px] font-medium text-muted">
              Total aktif
            </p>
            <p className="mt-2 break-words font-jakarta text-[38px] font-extrabold leading-tight tracking-tight text-midnight sm:text-[48px]">
              {formatRupiah(totalBalance)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat icon={Wallet} label="Aktif" value={activeWalletCount} />
            <Stat icon={Info} label="Riwayat" value="Aman" muted />
            <Stat icon={Target} label="Target" value={`${fundedGoalsCount}/${goals.length || 0}`} />
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-[26px] border border-midnight/10 bg-[#FBFCFE] p-3 shadow-[0_18px_44px_rgba(15,23,42,0.04)] sm:p-4">
        {wallets.length > 0 ? (
          <div className="space-y-3">
            {wallets.map((wallet) => (
              <WalletRow
                key={wallet.id}
                wallet={wallet}
                formatRupiah={formatRupiah}
                onRename={() => handleRenameWallet(wallet)}
                onDelete={() => onDeleteWallet(wallet.id)}
              />
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddWallet(true)}
            className="flex w-full items-center gap-4 rounded-[22px] border border-dashed border-midnight/15 bg-white px-5 py-6 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"
          >
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-emerald-50 text-emerald-600">
              <Plus size={28} strokeWidth={2.2} />
            </span>
            <span>
              <span className="block font-jakarta text-[18px] font-extrabold text-midnight">Tambah dompet</span>
              <span className="mt-1 block text-[15px] font-medium text-muted">Mulai dari dompet utama kamu.</span>
            </span>
          </button>
        )}
      </section>

      <div className="mb-6 flex items-start gap-4 rounded-[16px] border border-emerald-100 bg-emerald-50/50 px-5 py-4 text-muted">
        <Info size={28} className="mt-0.5 shrink-0 text-emerald-600" />
        <p className="text-[16px] font-medium leading-relaxed">
          Menghapus dompet akan menghapus dompet dan riwayat terkait.
        </p>
      </div>

      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-jakarta text-[24px] font-extrabold tracking-tight text-midnight">Target</h2>
          <p className="mt-1 text-[15px] font-medium text-muted">{goals.length} target</p>
        </div>
        <button
          onClick={() => setShowAddGoal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-midnight/10 bg-white px-4 py-3 font-jakarta text-[15px] font-bold text-emerald-600 shadow-sm transition-all hover:bg-emerald-50"
        >
          <Plus size={15} strokeWidth={2.4} />
          Target
        </button>
      </div>

      {goals.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {goals.map((goal) => {
            const progress = Math.min(100, (goal.current_amount / goal.target_amount) * 100)
            const remainingAmount = Math.max(Number(goal.target_amount || 0) - Number(goal.current_amount || 0), 0)

            return (
              <div
                key={goal.id}
                className="rounded-[22px] border border-midnight/10 bg-white p-4 shadow-sm transition-all hover:border-emerald-200 sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <Target size={30} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="truncate font-jakarta text-[19px] font-extrabold tracking-tight text-midnight">
                        {goal.name}
                      </h4>
                      <p className="mt-1 text-[15px] font-medium text-muted">
                        Terkumpul {formatRupiah(goal.current_amount)} dari target {formatRupiah(goal.target_amount)}
                      </p>
                    </div>
                  </div>

                  <span className="font-jakarta text-[24px] font-extrabold text-emerald-600">
                    {Math.round(progress)}%
                  </span>
                </div>

                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-muted">
                    <span className="inline-flex items-center gap-2"><Calendar size={16} /> Target</span>
                    <span>Sisa {formatRupiah(remainingAmount)}</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-midnight/10">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleRenameGoal(goal)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-midnight/10 bg-white px-3 py-3 font-jakarta text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted transition-all hover:border-midnight/20 hover:text-midnight"
                    title="Ubah target"
                  >
                    <Pencil size={14} strokeWidth={2.1} />
                    Ubah
                  </button>
                  <button
                    onClick={() => onDeleteGoal(goal.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-3 font-jakarta text-[11px] font-extrabold uppercase tracking-[0.1em] text-red-600 transition-all hover:bg-red-100"
                  >
                    <X size={15} strokeWidth={2.1} />
                    Hapus
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddGoal(true)}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-dashed border-midnight/20 bg-white/60 px-5 py-8 text-center transition-all hover:border-midnight/30 hover:bg-white"
        >
          <Target size={20} className="text-muted" />
          <span className="font-jakarta text-[12px] font-extrabold uppercase tracking-[0.12em] text-midnight">
            Buat target
          </span>
        </button>
      )}

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

function WalletRow({ wallet, formatRupiah, onRename, onDelete }) {
  const balance = formatWalletBalance(wallet.current_balance)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
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

  return (
    <div className="grid grid-cols-[auto,minmax(0,1fr),auto] items-start gap-4 rounded-[24px] border border-midnight/8 bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)] transition-all hover:border-emerald-200/80 hover:shadow-[0_16px_34px_rgba(15,23,42,0.06)] sm:px-5 sm:py-5">
      <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br from-slate-50 to-white ring-1 ring-midnight/5 sm:h-[76px] sm:w-[76px]">
        <WalletIcon walletName={wallet.name} size={40} />
      </div>
      <div className="min-w-0">
        <h3 className="truncate font-jakarta text-[21px] font-extrabold tracking-tight text-midnight sm:text-[22px]">
          {wallet.name}
        </h3>
        <p className="mt-2 text-[15px] font-medium text-muted sm:text-[16px]">
          {formatWalletTypeLabel(wallet.wallet_type)}
        </p>
      </div>
      <div className="relative flex min-w-[88px] flex-col items-end pt-1 text-right">
        <p className="font-jakarta text-[20px] font-extrabold tracking-tight text-midnight sm:text-[21px]">
          {formatRupiah(balance)}
        </p>
        <div ref={menuRef} className="relative mt-4">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-midnight/8 bg-slate-50 text-muted shadow-sm transition-all hover:border-midnight/12 hover:bg-white hover:text-midnight"
            aria-label={`Aksi untuk ${wallet.name}`}
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={18} />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-full z-20 mt-2 w-36 overflow-hidden rounded-[16px] border border-midnight/10 bg-white p-1.5 text-left shadow-[0_18px_32px_rgba(15,23,42,0.12)]">
              <button
                type="button"
                onClick={handleRenameClick}
                className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2.5 text-[14px] font-semibold text-midnight transition-colors hover:bg-slate-50"
              >
                <Pencil size={15} />
                Ubah
              </button>
              <button
                type="button"
                onClick={handleDeleteClick}
                className="mt-1 flex w-full items-center gap-2 rounded-[12px] px-3 py-2.5 text-[14px] font-semibold text-red-600 transition-colors hover:bg-red-50"
              >
                <Trash2 size={15} />
                Hapus
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Stat({ icon: IconComponent, label, value, muted = false }) {

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[16px] border border-midnight/10 bg-white px-3 py-4">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${muted ? 'bg-midnight/5 text-muted' : 'bg-emerald-50 text-emerald-600'}`}>
        {createElement(IconComponent, { size: 24, strokeWidth: 2.2 })}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-jakarta text-[15px] font-medium text-muted">
          {label}
        </span>
        <span className="mt-0.5 block truncate font-jakarta text-[20px] font-extrabold tracking-tight text-midnight">
          {value}
        </span>
      </span>
    </div>
  )
}
