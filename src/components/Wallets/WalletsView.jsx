import { useState } from 'react'
import { Plus, X, Target, Pencil, AlertTriangle, Wallet } from 'lucide-react'
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
    <div className="mx-auto max-w-6xl px-4 pb-6 pt-5 md:px-6 md:pb-8 md:pt-6">
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

      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-jakarta text-[22px] font-extrabold tracking-tight text-midnight">Dompet</h2>
          <p className="mt-1 text-[13px] font-semibold text-muted">Saldo dan target.</p>
        </div>
        <button
          onClick={() => setShowAddWallet(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-midnight px-3.5 py-2.5 font-jakarta text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98] sm:px-4 sm:py-3"
        >
          <Plus size={15} strokeWidth={2.4} />
          Tambah
        </button>
      </div>

      <section className="mb-4 rounded-lg border border-midnight/8 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-jakarta text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
              Total aktif
            </p>
            <p className="mt-1.5 break-words font-jakarta text-[32px] font-extrabold leading-tight tracking-tight text-midnight md:text-[40px]">
              {formatRupiah(totalBalance)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-midnight/8 pt-3 lg:min-w-[320px] lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <Stat label="Dompet" value={activeWalletCount} />
            <Stat label="Target" value={`${fundedGoalsCount}/${goals.length || 0}`} />
          </div>
        </div>
      </section>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {wallets.map((wallet) => {
          const balance = formatWalletBalance(wallet.current_balance)

          return (
            <div
              key={wallet.id}
              className="flex min-h-[188px] flex-col rounded-lg border border-midnight/8 bg-white p-4 shadow-sm transition-all hover:border-midnight/16 hover:shadow-premium"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-midnight/8 bg-champagne text-midnight">
                    <WalletIcon walletName={wallet.name} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-jakarta text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                      Dompet
                    </p>
                    <h3 className="mt-1 truncate font-jakarta text-[17px] font-extrabold tracking-tight text-midnight">
                      {wallet.name}
                    </h3>
                  </div>
                </div>

                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-emerald-700">
                  Aktif
                </span>
              </div>

              <div className="mt-4">
                <p className="font-jakarta text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                  Saldo
                </p>
                <p className="mt-1.5 break-words font-jakarta text-[24px] font-extrabold leading-tight tracking-tight text-midnight">
                  {formatRupiah(balance)}
                </p>
              </div>

              <div className="mt-auto pt-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleRenameWallet(wallet)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-midnight/10 bg-white px-3 py-3 font-jakarta text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted transition-all hover:border-midnight/20 hover:text-midnight"
                    title="Ubah nama"
                  >
                    <Pencil size={14} strokeWidth={2.1} />
                    Ubah
                  </button>
                  <button
                    onClick={() => onDeleteWallet(wallet.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-3 font-jakarta text-[11px] font-extrabold uppercase tracking-[0.1em] text-red-600 transition-all hover:bg-red-100"
                    title="Hapus dompet"
                  >
                    <X size={15} strokeWidth={2.1} />
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        <button
          type="button"
          onClick={() => setShowAddWallet(true)}
          className="flex min-h-[204px] flex-col items-center justify-center rounded-lg border border-dashed border-midnight/20 bg-white/60 p-6 text-center transition-all hover:border-midnight/30 hover:bg-white"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-champagne text-midnight">
            <Wallet size={22} strokeWidth={2} />
          </div>
          <p className="font-jakarta text-[12px] font-extrabold uppercase tracking-[0.12em] text-midnight">
            Dompet baru
          </p>
        </button>
      </div>

      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-jakarta text-[18px] font-extrabold tracking-tight text-midnight">Target</h2>
          <p className="mt-1 text-[13px] font-semibold text-muted">{goals.length} target</p>
        </div>
        <button
          onClick={() => setShowAddGoal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-midnight/10 bg-white px-4 py-3 font-jakarta text-[11px] font-extrabold uppercase tracking-[0.12em] text-midnight shadow-sm transition-all hover:bg-champagne"
        >
          <Plus size={15} strokeWidth={2.4} />
          Target
        </button>
      </div>

      {goals.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {goals.map((goal) => {
            const progress = Math.min(100, (goal.current_amount / goal.target_amount) * 100)
            const remainingAmount = Math.max(Number(goal.target_amount || 0) - Number(goal.current_amount || 0), 0)

            return (
              <div
                key={goal.id}
                className="rounded-lg border border-midnight/8 bg-white p-4 shadow-sm transition-all hover:border-midnight/16 hover:shadow-premium"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-gold">
                      <Target size={20} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="truncate font-jakarta text-[17px] font-extrabold tracking-tight text-midnight">
                        {goal.name}
                      </h4>
                      <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                        {formatRupiah(goal.target_amount)}
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full bg-midnight/5 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                    {Math.round(progress)}%
                  </span>
                </div>

                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-muted">
                    <span>{formatRupiah(goal.current_amount)}</span>
                    <span>Sisa {formatRupiah(remainingAmount)}</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-cream">
                    <div
                      className="h-full rounded-full bg-gold transition-all duration-700"
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

function Stat({ label, value }) {
  return (
    <div className="min-w-0 rounded-md bg-champagne px-2.5 py-2.5 md:bg-transparent md:px-0 md:py-0">
      <p className="truncate font-jakarta text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted md:text-[10px]">
        {label}
      </p>
      <p className="mt-1 truncate font-jakarta text-[14px] font-extrabold tracking-tight text-midnight md:text-[17px]">
        {value}
      </p>
    </div>
  )
}
