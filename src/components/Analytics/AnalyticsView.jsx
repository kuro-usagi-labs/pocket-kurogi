import { CategoryIcon } from '../shared/CategoryIcon'
import { AlertCircle } from 'lucide-react'

export default function AnalyticsView({ analytics, budgets = [], formatRupiah }) {
  const {
    totalIncome = 0,
    totalExpense = 0,
    totalSavings = 0,
    netCashflow = 0,
    transferVolume = 0,
    topExpenseCategories = [],
  } = analytics || {}

  return (
    <div className="pt-8 px-6 pb-[140px] space-y-7">
      {/* Cash Flow Summary */}
      <div className="bg-midnight text-white rounded-[32px] p-8 relative overflow-hidden shadow-2xl shadow-midnight/20">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <h3 className="text-xl font-bold font-jakarta mb-1.5 tracking-tight">Ringkasan Arus Kas</h3>
          <p className="text-white/40 text-[10px] font-extrabold mb-8 tracking-widest uppercase font-jakarta">
            Seluruh Ledger Tercatat
          </p>
          <div className="space-y-5">
            <div className="flex justify-between items-center border-b border-white/10 pb-5">
              <span className="text-[13.5px] font-medium text-white/60">Pemasukan Kotor</span>
              <span className="text-[19px] font-extrabold font-jakarta">+{formatRupiah(totalIncome)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-white/10 pb-5">
              <span className="text-[13.5px] font-medium text-white/60">Pengeluaran Inti</span>
              <span className="text-[19px] font-extrabold font-jakarta text-gold">
                {formatRupiah(totalExpense)}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-white/10 pb-5">
              <span className="text-[13.5px] font-medium text-white/60">Alokasi Tabungan</span>
              <span className="text-[19px] font-extrabold font-jakarta text-[#BFE89E]">
                {formatRupiah(totalSavings)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-[13.5px] font-medium text-white/60">Net Cashflow</span>
              <span
                className={`text-[19px] font-extrabold font-jakarta ${
                  netCashflow >= 0 ? 'text-white' : 'text-rose-300'
                }`}
              >
                {netCashflow >= 0 ? '+' : '-'}
                {formatRupiah(Math.abs(netCashflow))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Categories & Budgets */}
      <div className="bg-white rounded-[32px] p-8 shadow-[0_12px_40px_rgba(0,0,0,0.03)] border border-midnight/5">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-[17px] font-bold font-jakarta text-midnight tracking-tight">
            Analisa Budget
          </h3>
          <span className="text-[10px] font-extrabold text-midnight/35 uppercase tracking-[0.2em]">
            Transfer Internal {formatRupiah(transferVolume)}
          </span>
        </div>
        <div className="space-y-8">
          {topExpenseCategories.length > 0 ? (
            topExpenseCategories.slice(0, 5).map((categorySummary, idx) => {
              const cat = categorySummary.name
              const amount = Number(categorySummary.amount || 0)
              const categoryBudget = budgets.find((budget) => budget.categories?.name === cat)
              const limit = categoryBudget?.monthly_limit || 0
              const usagePercent = limit > 0 ? (amount / limit) * 100 : 0
              const overflow = limit > 0 && amount > limit
              const displayPercent = Math.round(Number(categorySummary.percentage || 0))

              return (
                <div key={cat} className="space-y-3.5 group">
                  <div className="flex items-center gap-4">
                    <div className="w-[52px] h-[52px] rounded-2xl bg-ivory border border-midnight/5 flex items-center justify-center text-midnight shadow-sm group-hover:scale-105 transition-transform">
                      <CategoryIcon category={cat} size={22} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-extrabold text-muted uppercase tracking-widest opacity-60 capitalize">
                          {cat}
                        </p>
                        {overflow && (
                            <span className="flex items-center gap-1 text-[9px] font-extrabold text-red-500 uppercase tracking-tighter">
                                <AlertCircle size={10} /> Over Budget
                            </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <p className="text-[16px] font-bold font-jakarta text-midnight">
                          {formatRupiah(amount)}
                        </p>
                        {limit > 0 && (
                          <p className="text-[11px] font-medium text-midnight/30">
                            dari {formatRupiah(limit)}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-[13px] font-extrabold font-jakarta text-midnight">
                      {limit > 0 ? `${Math.round(usagePercent)}%` : `${displayPercent}%`}
                    </span>
                  </div>
                  
                  {/* Progress Bar Container */}
                  <div className="w-full h-2 bg-cream rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        overflow ? 'bg-red-500' : 
                        usagePercent >= 80 ? 'bg-orange-400' :
                        idx === 0 ? 'bg-gold' : 'bg-midnight/70'
                      }`}
                      style={{ width: `${Math.min(100, limit > 0 ? usagePercent : displayPercent)}%` }}
                    />
                  </div>
                </div>
              )
            })
          ) : (
            <p className="text-[14px] text-muted text-center py-6 font-medium">
              Belum ada arus kas yang terekam.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
