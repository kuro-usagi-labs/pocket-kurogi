import { useState } from 'react'
import { X, Target, Calendar, DollarSign } from 'lucide-react'

export default function AddGoalModal({ onClose, onSubmit }) {
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [deadline, setDeadline] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name || !targetAmount) return
    onSubmit({
      name,
      targetAmount: Number(targetAmount),
      deadline: deadline || null,
      icon: 'target'
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
      <div 
        className="absolute inset-0 bg-midnight/30 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />
      
      <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl relative z-10 animate-scale-in">
        <div className="p-8">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-[22px] font-jakarta font-bold text-midnight tracking-tight">Buat Milestone Baru</h3>
              <p className="text-midnight/40 text-[13px] font-medium mt-1">Siapkan target jangka panjang Anda</p>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center bg-ivory rounded-full text-midnight/30 hover:text-midnight transition-colors"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-muted uppercase tracking-widest ml-1">Nama Target</label>
              <div className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-midnight/30">
                  <Target size={18} />
                </div>
                <input
                  autoFocus
                  type="text"
                  required
                  placeholder="Contoh: Dana Properti, Liburan, Pendidikan"
                  className="w-full bg-ivory border-none rounded-2xl py-4 pl-12 pr-6 text-midnight font-bold placeholder:text-midnight/20 focus:ring-2 focus:ring-gold/50 transition-all text-sm outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-muted uppercase tracking-widest ml-1">Target Dana (Rp)</label>
              <div className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-midnight/30">
                  <DollarSign size={18} />
                </div>
                <input
                  type="number"
                  required
                  placeholder="0"
                  className="w-full bg-ivory border-none rounded-2xl py-4 pl-12 pr-6 text-midnight font-bold placeholder:text-midnight/20 focus:ring-2 focus:ring-gold/50 transition-all text-sm outline-none"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-muted uppercase tracking-widest ml-1">Deadline (Opsional)</label>
              <div className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-midnight/30">
                  <Calendar size={18} />
                </div>
                <input
                  type="date"
                  className="w-full bg-ivory border-none rounded-2xl py-4 pl-12 pr-6 text-midnight font-bold placeholder:text-midnight/20 focus:ring-2 focus:ring-gold/50 transition-all text-sm outline-none"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-midnight text-white py-4 rounded-2xl font-extrabold text-[12px] uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-midnight/20 mt-4"
            >
              Simpan Target
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
