import { useState } from 'react'
import { Plus, X, Target } from 'lucide-react'
import { WalletIcon } from '../shared/CategoryIcon'
import AddWalletModal from './AddWalletModal'

export default function WalletsView({ wallets, totalBalance, onAddWallet, onDeleteWallet, formatRupiah }) {
  const [showAddWallet, setShowAddWallet] = useState(false)

  return (
    <div className="pt-8 px-6 pb-[140px]">
      {/* Total Balance */}
      <div className="mb-8 pl-1">
        <h2 className="text-[10px] font-extrabold text-muted uppercase tracking-[0.25em] mb-2 font-jakarta opacity-80">
          Total Likuiditas
        </h2>
        <div className="flex items-baseline gap-2">
          <span className="text-[38px] font-extrabold text-midnight font-jakarta tracking-tighter leading-tight drop-shadow-sm">
            {formatRupiah(totalBalance)}
          </span>
        </div>
      </div>

      {/* Wallet Grid */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        {wallets.map((w) => (
          <div
            key={w.id}
            className="bg-white border border-midnight/5 rounded-[24px] p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] relative group hover:border-midnight/10 transition-colors"
          >
            <button
              onClick={() => onDeleteWallet(w.id)}
              className="absolute top-3 right-3 p-1.5 text-muted/30 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
            >
              <X size={14} strokeWidth={2} />
            </button>
            <div className="w-11 h-11 bg-ivory rounded-full flex items-center justify-center text-midnight mb-4 border border-midnight/5 shadow-sm">
              <WalletIcon walletName={w.name} />
            </div>
            <p className="text-[10px] font-extrabold text-muted uppercase tracking-widest truncate">
              {w.name}
            </p>
            <p className="text-[16px] font-extrabold text-midnight mt-1 font-jakarta">
              {formatRupiah(Number(w.current_balance))}
            </p>
          </div>
        ))}

        {/* Add Wallet Button */}
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
      </div>

      {/* Milestone CTA Card */}
      <div className="bg-midnight p-8 rounded-[32px] flex flex-col justify-between items-start text-white shadow-2xl shadow-midnight/30 relative overflow-hidden">
        <div className="w-14 h-14 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-6 border border-white/5">
          <Target size={26} className="text-white" strokeWidth={1.5} />
        </div>
        <div className="relative z-10">
          <h3 className="text-[22px] font-jakarta font-bold mb-2.5 leading-tight tracking-tight">
            Rencanakan Milestone
          </h3>
          <p className="text-white/60 text-[13.5px] font-inter leading-relaxed mb-8 font-medium">
            Tetapkan target untuk akuisisi properti, perjalanan, atau pertumbuhan jangka panjang.
          </p>
          <button className="bg-champagne text-midnight px-7 py-3.5 rounded-full font-jakarta font-extrabold text-[11px] tracking-[0.15em] uppercase hover:opacity-90 hover:scale-105 active:scale-95 transition-all w-full shadow-lg shadow-black/20">
            Buat Target Baru
          </button>
        </div>
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-gold/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Add Wallet Modal */}
      {showAddWallet && (
        <AddWalletModal
          onClose={() => setShowAddWallet(false)}
          onSubmit={onAddWallet}
        />
      )}
    </div>
  )
}
