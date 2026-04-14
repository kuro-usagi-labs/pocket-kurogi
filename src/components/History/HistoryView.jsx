import { Sparkles, X } from 'lucide-react'
import { CategoryIcon } from '../shared/CategoryIcon'

export default function HistoryView({ transactions, formatRupiah, onDeleteTransaction }) {
  return (
    <div className="pt-8 px-6 pb-[140px]">
      {/* Search bar */}
      <div className="relative flex items-center bg-white border border-midnight/10 shadow-[0_8px_30px_rgba(15,23,42,0.03)] rounded-2xl p-1.5 mb-8">
        <div className="px-3 text-muted">
          <Sparkles size={18} strokeWidth={2} />
        </div>
        <input
          className="w-full bg-transparent border-none focus:ring-0 text-midnight placeholder:text-muted/40 py-2.5 px-1 font-jakarta font-semibold text-[14.5px] outline-none"
          placeholder="Cari transaksi portofolio..."
          type="text"
        />
      </div>

      <div className="space-y-8">
        <div>
          <h2 className="text-midnight/50 text-[10px] font-extrabold uppercase tracking-[0.25em] mb-4 px-1 font-jakarta">
            Riwayat Eksekusi
          </h2>
          <div className="space-y-3.5">
            {transactions.length === 0 ? (
              <p className="text-sm text-center text-muted py-10 font-medium">
                Belum ada aktivitas terekam.
              </p>
            ) : (
              transactions.map((t) => (
                <div
                  key={t.id}
                  className="bg-white p-5 rounded-[20px] flex items-center justify-between border border-midnight/5 hover:shadow-[0_8px_30px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 transition-all duration-300 relative group"
                >
                  <button
                    onClick={() => onDeleteTransaction(t.id)}
                    className="absolute top-3 right-3 p-1.5 text-muted/20 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                    title="Hapus transaksi"
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>

                  <div className="flex items-center gap-4">
                    <div className="w-[50px] h-[50px] rounded-2xl bg-ivory flex items-center justify-center text-midnight border border-midnight/5 shadow-sm">
                      <CategoryIcon category={t.category} size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-midnight font-jakarta text-[14.5px] capitalize tracking-tight">
                        {t.desc}
                      </h3>
                      <p className="text-[11.5px] font-medium text-muted/60 mt-0.5">
                        {t.date} • {t.time}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-jakarta font-extrabold text-[15.5px] tracking-tight ${
                        t.type === 'income' ? 'text-gold' : 'text-midnight'
                      }`}
                    >
                      {t.type === 'income' ? '+' : '-'}
                      {formatRupiah(t.amount)}
                    </p>
                    <p className="text-[9.5px] text-muted/50 uppercase font-extrabold tracking-widest mt-1">
                      {t.wallet}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
