import { useState } from 'react'
import { X } from 'lucide-react'

export default function AddWalletModal({ onClose, onSubmit }) {
  const [name, setName] = useState('')
  const [balance, setBalance] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit(name.trim(), parseFloat(balance) || 0)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-midnight/40 backdrop-blur-md flex items-center justify-center p-4 transition-opacity animate-fade-in">
      <div className="bg-champagne rounded-[32px] p-7 w-full max-w-[340px] shadow-2xl border border-white/20">
        <div className="flex justify-between items-center mb-7">
          <h2 className="text-[19px] font-bold text-midnight font-jakarta tracking-tight">
            Portofolio Baru
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-midnight bg-ivory border border-midnight/5 rounded-full p-2 hover:bg-[#EBE7D9] transition-colors"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-[10.5px] font-extrabold text-muted uppercase mb-2 tracking-[0.15em] font-jakarta">
              Institusi / Nama
            </label>
            <input
              required
              type="text"
              placeholder="Cth: Mandiri, Investasi..."
              className="w-full bg-ivory border border-midnight/10 rounded-2xl px-4 py-3.5 text-[14.5px] font-semibold text-midnight focus:outline-none focus:ring-1 focus:ring-midnight/40 font-inter transition-all"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="mb-8">
            <label className="block text-[10.5px] font-extrabold text-muted uppercase mb-2 tracking-[0.15em] font-jakarta">
              Likuiditas Awal (Rp)
            </label>
            <input
              required
              type="number"
              placeholder="500000"
              className="w-full bg-ivory border border-midnight/10 rounded-2xl px-4 py-3.5 text-[14.5px] font-semibold text-midnight focus:outline-none focus:ring-1 focus:ring-midnight/40 font-inter transition-all"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-midnight text-white font-bold font-jakarta text-[13px] uppercase tracking-[0.2em] py-4 rounded-2xl shadow-xl shadow-midnight/20 hover:opacity-90 active:scale-95 transition-all"
          >
            Inisialisasi
          </button>
        </form>
      </div>
    </div>
  )
}
