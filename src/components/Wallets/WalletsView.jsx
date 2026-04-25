import { createElement, useState } from 'react'
import { Calendar, ChevronRight, Info, Plus, Target, Trash2, Pencil, AlertTriangle, Wallet } from 'lucide-react'
import { WalletIcon } from '../shared/CategoryIcon'
import AddWalletModal from './AddWalletModal'
import AddGoalModal from './AddGoalModal'
import RenameEntityModal from '../shared/RenameEntityModal'

function formatWalletBalance(value) {
  return Number(value || 0)
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

      <div className="mb-6 overflow-hidden rounded-[22px] border border-midnight/10 bg-white shadow-[0_14px_38px_rgba(15,23,42,0.05)]">
        {wallets.map((wallet) => (
          <WalletRow
            key={wallet.id}
            wallet={wallet}
            formatRupiah={formatRupiah}
            onRename={() => handleRenameWallet(wallet)}
            onDelete={() => onDeleteWallet(wallet.id)}
          />
        ))}
        <button
          type="button"
          onClick={() => setShowAddWallet(true)}
          className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-emerald-50/50"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-emerald-50 text-emerald-600">
            <Plus size={26} strokeWidth={2.2} />
          </span>
          <span className="font-jakarta text-[18px] font-extrabold text-midnight">Dompet baru</span>
        </button>
      </div>

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

  return (
    <div className="group flex items-center gap-4 border-b border-midnight/8 px-5 py-4 last:border-b-0">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[16px] bg-emerald-50 text-emerald-600">
        <WalletIcon walletName={wallet.name} size={34} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-jakarta text-[19px] font-extrabold tracking-tight text-midnight">
          {wallet.name}
        </h3>
        <p className="mt-1 text-[15px] font-medium text-muted">
          Dompet {String(wallet.wallet_type || 'aktif').replace('_', ' ')}
        </p>
      </div>
      <div className="hidden items-center gap-1 sm:flex">
        <button
          type="button"
          onClick={onRename}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-muted opacity-0 transition-all hover:bg-champagne hover:text-midnight group-hover:opacity-100"
          aria-label={`Ubah ${wallet.name}`}
          title="Ubah nama"
        >
          <Pencil size={17} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-muted opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
          aria-label={`Hapus ${wallet.name}`}
          title="Hapus dompet"
        >
          <Trash2 size={17} />
        </button>
      </div>
      <div className="flex items-center gap-1 sm:hidden">
        <button
          type="button"
          onClick={onRename}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-champagne text-muted"
          aria-label={`Ubah ${wallet.name}`}
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600"
          aria-label={`Hapus ${wallet.name}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-jakarta text-[18px] font-bold tracking-tight text-midnight">
          {formatRupiah(balance)}
        </p>
      </div>
      <ChevronRight size={23} className="hidden shrink-0 text-muted sm:block" />
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
