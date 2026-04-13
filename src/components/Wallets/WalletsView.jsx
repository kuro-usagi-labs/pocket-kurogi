import { useState } from 'react'
import { Plus, X, Target, Flag } from 'lucide-react'
import { WalletIcon } from '../shared/CategoryIcon'
import AddWalletModal from './AddWalletModal'
import AddGoalModal from './AddGoalModal'

export default function WalletsView({ 
  wallets, 
  totalBalance, 
  goals = [], 
  onAddWallet, 
  onDeleteWallet, 
  onAddGoal, 
  onDeleteGoal, 
  formatRupiah 
}) {
  const [showAddWallet, setShowAddWallet] = useState(false)
  const [showAddGoal, setShowAddGoal] = useState(false)

  return (
    <div className="pt-8 px-6 pb-[140px]">
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
                    <button 
                      onClick={() => onDeleteGoal(goal.id)}
                      className="p-1.5 text-midnight/10 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                    >
                      <X size={14} />
                    </button>
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
