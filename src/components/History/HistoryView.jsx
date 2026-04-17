import { Sparkles, X } from 'lucide-react'
import { TransactionIcon } from '../shared/CategoryIcon'

export default function HistoryView({
  transactions,
  formatRupiah,
  onDeleteTransaction,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}) {
  return (
    <div className="pt-8 px-6 pb-[140px]">
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
              <>
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="bg-white p-5 rounded-[20px] flex items-center justify-between border border-midnight/5 hover:shadow-[0_8px_30px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 transition-all duration-300 relative group"
                  >
                    {transaction.canDelete && (
                      <button
                        onClick={() => onDeleteTransaction(transaction.id)}
                        className="absolute top-3 right-3 p-1.5 text-muted/20 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                        title="Hapus transaksi"
                      >
                        <X size={14} strokeWidth={2.5} />
                      </button>
                    )}

                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-[50px] h-[50px] rounded-2xl bg-ivory flex items-center justify-center text-midnight border border-midnight/5 shadow-sm shrink-0">
                        <TransactionIcon
                          iconKey={transaction.iconKey}
                          category={transaction.category}
                          size={22}
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-midnight font-jakarta text-[14.5px] tracking-tight truncate">
                          {transaction.title || transaction.desc}
                        </h3>
                        <p className="text-[11.5px] font-medium text-muted/60 mt-0.5 truncate">
                          {[transaction.subtitle, transaction.date, transaction.time].filter(Boolean).join(' - ')}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-4">
                      <p
                        className={`font-jakarta font-extrabold text-[15.5px] tracking-tight ${
                          transaction.type === 'income' ? 'text-gold' : 'text-midnight'
                        }`}
                      >
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatRupiah(transaction.amount)}
                      </p>
                      <p className="text-[9.5px] text-muted/50 uppercase font-extrabold tracking-widest mt-1">
                        {transaction.wallet}
                      </p>
                    </div>
                  </div>
                ))}

                {hasMore && (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={onLoadMore}
                      className="px-4 py-2 rounded-full bg-white border border-midnight/10 text-[11px] font-extrabold uppercase tracking-[0.18em] text-midnight/60 font-jakarta shadow-sm hover:bg-ivory transition-colors"
                    >
                      {loadingMore ? 'Memuat...' : 'Muat Riwayat Lama'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
