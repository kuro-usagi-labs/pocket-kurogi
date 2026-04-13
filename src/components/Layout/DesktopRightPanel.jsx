import { DollarSign, Landmark, ChevronRight, ReceiptText } from 'lucide-react'
import { useTransactions } from '../../hooks/useTransactions'

export default function DesktopRightPanel() {
  const { transactions, totalIncome, totalExpense } = useTransactions()

  // Calculate Health Score (0-100) based on savings rate
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0
  let healthScore = Math.min(99, Math.max(10, Math.round(savingsRate)))
  if (totalIncome === 0 && totalExpense === 0) healthScore = 100 // Unused vault

  // Calculate Allocation Mix (Expenses by Category)
  const categoryTotals = {}
  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + (t.amount || 0)
    })

  const sortedCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(number)
  }

  return (
    <aside className="hidden xl:flex w-80 bg-[#faf9f4] flex-col p-8 space-y-8 border-l border-black/5 overflow-y-auto overflow-x-hidden relative h-screen">
      <div>
        <h3 className="text-[10px] font-extrabold text-midnight/40 tracking-[0.2em] uppercase mb-6">Asset Intelligence</h3>
        <div className="space-y-4">
          
          {/* Health Score */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-midnight/5 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-gold/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10">
              <p className="text-[10px] font-bold text-midnight/40 uppercase tracking-widest mb-2">Vault Health</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-jakarta font-extrabold text-midnight">{healthScore}</span>
                <span className={`text-xs font-bold ${savingsRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {savingsRate >= 0 ? '+' : ''}{savingsRate.toFixed(1)}%
                </span>
              </div>
              <p className="text-[10px] text-midnight/50 font-medium mt-2">Optimal Liquidity Ratio</p>
            </div>
          </div>

          {/* Allocation Mix */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-midnight/5">
            <p className="text-[10px] font-bold text-midnight/40 uppercase tracking-widest mb-6">Allocation Mix</p>
            <div className="space-y-5">
              {sortedCategories.map(([cat, amount], idx) => {
                const percentage = Math.round((amount / totalExpense) * 100)
                const colors = ['bg-midnight', 'bg-gold', 'bg-slate-300']
                return (
                  <div key={cat} className={`flex justify-between items-center ${idx === 2 ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-1 h-4 rounded-full ${colors[idx] || colors[0]}`}></div>
                      <span className="text-xs font-bold text-slate-600 capitalize">{cat}</span>
                    </div>
                    <span className="text-xs font-bold">{percentage}%</span>
                  </div>
                )
              })}
              {sortedCategories.length === 0 && (
                <p className="text-xs text-midnight/40 italic">No expense data yet</p>
              )}
            </div>
          </div>

          {/* Action Card */}
          <div className="bg-midnight p-6 rounded-2xl shadow-xl relative overflow-hidden mt-4">
            <div className="absolute top-0 right-0 p-2 opacity-10">
              <Landmark size={48} className="text-white" />
            </div>
            <h4 className="text-white text-sm font-bold mb-2">Yield Optimization</h4>
            <p className="text-white/60 text-[11px] leading-relaxed mb-4">
              Your largest expense is <span className="text-gold font-bold capitalize">{sortedCategories[0]?.[0] || 'Unknown'}</span>. 
              Reduce it by 20% to save <span className="text-gold font-bold">
                {sortedCategories[0]?.[1] ? formatRupiah(sortedCategories[0][1] * 0.2) : 'Rp0'}
              </span> this month.
            </p>
            <button className="w-full py-2.5 bg-gold text-white text-[10px] font-extrabold uppercase tracking-widest rounded-lg hover:brightness-110 transition-all">
              Execute Strategy
            </button>
          </div>
        </div>
      </div>

      <div className="pt-4 pb-12">
        <h4 className="text-[10px] font-bold text-midnight/40 tracking-widest uppercase mb-4">Recent Activity</h4>
        <div className="space-y-2">
          {transactions.slice(0, 3).map((tx) => (
            <div key={tx.id} className="bg-white rounded-xl p-4 border border-midnight/5 flex items-center gap-3 hover:border-gold transition-colors cursor-pointer group">
              <div className="w-10 h-10 rounded-lg bg-[#faf9f4] flex items-center justify-center border border-midnight/5 shrink-0">
                <ReceiptText size={18} className="text-midnight/40 group-hover:text-midnight transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold truncate text-midnight">{tx.desc}</p>
                <p className="text-[9px] text-midnight/60 font-bold">{formatRupiah(tx.amount)} • {tx.date}</p>
              </div>
              <ChevronRight size={14} className="text-midnight/30" />
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
