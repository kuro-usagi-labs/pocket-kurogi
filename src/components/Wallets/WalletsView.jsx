import { useState } from 'react'
import { Plus, X, Target, Flag, Pencil, AlertTriangle, Archive, RotateCcw } from 'lucide-react'
import { WalletIcon } from '../shared/CategoryIcon'
import AddWalletModal from './AddWalletModal'
import AddGoalModal from './AddGoalModal'

export default function WalletsView({ 
  wallets, 
  archivedWallets = [],
  totalBalance, 
  goals = [], 
  conflicts = { wallets: [], goals: [] },
  onAddWallet, 
  onDeleteWallet, 
  onRestoreWallet,
  onRenameWallet,
  onAddGoal, 
  onDeleteGoal, 
  onRenameGoal,
  formatRupiah 
}) {
  const [showAddWallet, setShowAddWallet] = useState(false)
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [walletTab, setWalletTab] = useState('active')
  const hasConflicts = conflicts.wallets.length > 0 || conflicts.goals.length > 0
  const activeWalletCount = wallets.length
  const archivedWalletCount = archivedWallets.length
  const showingArchivedWallets = walletTab === 'archived'
  const visibleWallets = showingArchivedWallets ? archivedWallets : wallets

  const handleRenameWallet = async (wallet) => {
    const nextName = window.prompt('Nama baru untuk dompet ini:', wallet.name)
    if (!nextName || nextName.trim() === wallet.name) return

    const result = await onRenameWallet(wallet.id, nextName)
    if (result?.error) {
      window.alert(result.error.message || 'Nama dompet belum bisa diubah.')
    }
  }

  const handleRenameGoal = async (goal) => {
    const nextName = window.prompt('Nama baru untuk target ini:', goal.name)
    if (!nextName || nextName.trim() === goal.name) return

    const result = await onRenameGoal(goal.id, nextName)
    if (result?.error) {
      window.alert(result.error.message || 'Nama target belum bisa diubah.')
    }
  }

  return (
    <div className="pt-8 px-6 pb-[140px]">
      {hasConflicts ? (
        <div className="mb-6 rounded-[24px] border border-amber-200 bg-amber-50/90 px-5 py-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700">
              <AlertTriangle size={16} />
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-amber-800 font-jakarta">
                Audit Nama Diperlukan
              </p>
              <p className="text-[13px] font-medium leading-relaxed text-amber-900/80">
                Ada dompet atau target dengan nama aktif yang bentrok. Rename item terkait dulu supaya index unik backend bisa aktif dengan aman.
              </p>
              {conflicts.wallets.map((conflict) => (
                <p key={`wallet-${conflict.normalizedName}`} className="text-[12px] font-semibold text-amber-900/80">
                  Dompet: {conflict.items.map((item) => item.name).join(', ')}
                </p>
              ))}
              {conflicts.goals.map((conflict) => (
                <p key={`goal-${conflict.normalizedName}`} className="text-[12px] font-semibold text-amber-900/80">
                  Target: {conflict.items.map((item) => item.name).join(', ')}
                </p>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Total Balance */}
      <div className="mb-8 pl-1">
        <h2 className="text-[10px] font-extrabold text-muted uppercase tracking-[0.25em] mb-2 font-jakarta opacity-80">
          Akumulasi Saldo
        </h2>
        <div className="flex items-baseline gap-2">
          <span className="text-[38px] font-extrabold text-midnight font-jakarta tracking-tighter leading-tight drop-shadow-sm">
            {formatRupiah(totalBalance)}
          </span>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-2 rounded-[24px] bg-white/75 p-2 shadow-[0_6px_24px_rgba(15,23,42,0.04)] backdrop-blur-sm">
        <button
          onClick={() => setWalletTab('active')}
          className={`flex-1 rounded-[18px] px-4 py-3 text-left transition-all ${
            showingArchivedWallets
              ? 'text-midnight/55 hover:bg-ivory'
              : 'bg-midnight text-white shadow-lg shadow-midnight/15'
          }`}
        >
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] font-jakarta">
            Aktif
          </p>
          <p className={`mt-1 text-[13px] font-bold ${showingArchivedWallets ? 'text-midnight' : 'text-white'}`}>
            {activeWalletCount} dompet aktif
          </p>
        </button>
        <button
          onClick={() => setWalletTab('archived')}
          className={`flex-1 rounded-[18px] px-4 py-3 text-left transition-all ${
            showingArchivedWallets
              ? 'bg-midnight text-white shadow-lg shadow-midnight/15'
              : 'text-midnight/55 hover:bg-ivory'
          }`}
        >
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] font-jakarta">
            Arsip
          </p>
          <p className={`mt-1 text-[13px] font-bold ${showingArchivedWallets ? 'text-white' : 'text-midnight'}`}>
            {archivedWalletCount} dompet tersimpan
          </p>
        </button>
      </div>

      {showingArchivedWallets ? (
        <div className="mb-6 rounded-[24px] border border-midnight/8 bg-white/80 px-5 py-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-midnight/5 p-2 text-midnight/70">
              <Archive size={16} />
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-midnight font-jakarta">
                Arsip Dompet
              </p>
              <p className="text-[13px] font-medium leading-relaxed text-midnight/65">
                Dompet arsip tetap terlihat di sini supaya tidak ada histori yang terasa hilang. Ledger lamanya masih aman, tetapi dompet ini tidak dipakai lagi untuk input aktif maupun chat.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Wallet Grid */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        {visibleWallets.map((wallet) => (
          <div
            key={wallet.id}
            className={`rounded-[24px] p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] relative group transition-colors ${
              showingArchivedWallets
                ? 'bg-[#F5F1E6] border border-midnight/8'
                : 'bg-white border border-midnight/5 hover:border-midnight/10'
            }`}
          >
            {showingArchivedWallets ? (
              <>
                <span className="absolute top-3 right-3 rounded-full bg-midnight/8 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.18em] text-midnight/60">
                  Arsip
                </span>
                <button
                  onClick={() => onRestoreWallet(wallet.id)}
                  className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-midnight/70 shadow-sm transition-all hover:bg-white hover:text-midnight"
                  title="Pulihkan dompet ke daftar aktif"
                >
                  <RotateCcw size={11} strokeWidth={2.3} />
                  Pulihkan
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleRenameWallet(wallet)}
                  className="absolute top-3 left-3 p-1.5 text-muted/30 hover:text-midnight hover:bg-ivory rounded-full transition-all"
                  title="Ubah nama dompet"
                >
                  <Pencil size={13} strokeWidth={2} />
                </button>
                <button
                  onClick={() => onDeleteWallet(wallet.id)}
                  className="absolute top-3 right-3 p-1.5 text-muted/30 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                  title="Hapus dompet dari daftar aktif"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </>
            )}
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-midnight mb-4 border shadow-sm ${
              showingArchivedWallets ? 'bg-white/65 border-midnight/8' : 'bg-ivory border-midnight/5'
            }`}>
              <WalletIcon walletName={wallet.name} />
            </div>
            <p className="text-[10px] font-extrabold text-muted uppercase tracking-widest truncate">
              {wallet.name}
            </p>
            <p className="text-[16px] font-extrabold text-midnight mt-1 font-jakarta">
              {formatRupiah(Number(wallet.current_balance))}
            </p>
          </div>
        ))}

        {!showingArchivedWallets ? (
          <div
            onClick={() => setShowAddWallet(true)}
            className="border border-dashed border-midnight/20 bg-ivory/40 hover:bg-ivory rounded-[24px] p-5 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[130px] group"
          >
            <div className="bg-white w-10 h-10 rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-105 transition-transform">
              <Plus size={20} className="text-midnight/60" strokeWidth={2} />
            </div>
            <p className="text-[10.5px] font-extrabold text-midnight/60 font-jakarta uppercase tracking-widest text-center leading-relaxed">
              Tambah<br />Portofolio
            </p>
          </div>
        ) : null}
      </div>

      {visibleWallets.length === 0 ? (
        <div className="mb-10 rounded-[28px] border border-dashed border-midnight/15 bg-white/70 px-6 py-7 text-center shadow-sm">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted font-jakarta">
            {showingArchivedWallets ? 'Belum Ada Arsip' : 'Belum Ada Dompet Aktif'}
          </p>
          <p className="mt-2 text-[13px] font-medium leading-relaxed text-midnight/65">
            {showingArchivedWallets
              ? 'Begitu ada dompet yang dihapus dari daftar aktif, dompet itu akan tetap muncul di tab arsip ini.'
              : 'Buat dompet baru untuk mulai mencatat saldo dan transaksi.'}
          </p>
        </div>
      ) : null}

      {/* Goals Section */}
      {goals.length > 0 && (
        <div className="mb-10">
          <h2 className="text-[10px] font-extrabold text-muted uppercase tracking-[0.25em] mb-6 font-jakarta opacity-80 pl-1">
            Financial Milestones
          </h2>
          <div className="space-y-4">
            {goals.map((goal) => {
              const progress = Math.min(100, (goal.current_amount / goal.target_amount) * 100)
              return (
                <div key={goal.id} className="bg-white p-5 rounded-[28px] border border-midnight/5 shadow-sm relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gold/10 rounded-2xl flex items-center justify-center text-gold">
                        <Target size={20} />
                      </div>
                      <div>
                        <h4 className="text-[14px] font-bold text-midnight tracking-tight">{goal.name}</h4>
                        <p className="text-[10px] text-midnight/40 font-bold uppercase tracking-widest leading-none mt-1">
                          {formatRupiah(goal.target_amount)} Target
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleRenameGoal(goal)}
                        className="p-1.5 text-midnight/20 hover:text-midnight hover:bg-ivory rounded-full transition-all"
                        title="Ubah nama target"
                      >
                        <Pencil size={14} />
                      </button>
                      <button 
                        onClick={() => onDeleteGoal(goal.id)}
                        className="p-1.5 text-midnight/10 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[11px] font-bold text-midnight/60">
                        <span>{formatRupiah(goal.current_amount)} Terkumpul</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-ivory rounded-full overflow-hidden border border-midnight/5">
                      <div 
                        className="h-full bg-gold transition-all duration-1000 shadow-[0_0_12px_rgba(212,175,55,0.3)]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Milestone CTA Card */}
      <div className="bg-midnight p-8 rounded-[32px] flex flex-col justify-between items-start text-white shadow-2xl shadow-midnight/30 relative overflow-hidden">
        <div className="w-14 h-14 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-6 border border-white/5">
          <Flag size={26} className="text-white" strokeWidth={1.5} />
        </div>
        <div className="relative z-10">
          <h3 className="text-[22px] font-jakarta font-bold mb-2.5 leading-tight tracking-tight">
            Rencanakan Milestone
          </h3>
          <p className="text-white/60 text-[13.5px] font-inter leading-relaxed mb-8 font-medium">
            Tetapkan target untuk akuisisi properti, perjalanan, atau pertumbuhan jangka panjang.
          </p>
          <button 
            onClick={() => setShowAddGoal(true)}
            className="bg-champagne text-midnight px-7 py-3.5 rounded-full font-jakarta font-extrabold text-[11px] tracking-[0.15em] uppercase hover:opacity-90 hover:scale-105 active:scale-95 transition-all w-full shadow-lg shadow-black/20"
          >
            Buat Target Baru
          </button>
        </div>
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-gold/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Modals */}
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
    </div>
  )
}
