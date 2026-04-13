import { CategoryIcon } from '../shared/CategoryIcon'

export default function AnalyticsView({ transactions, totalIncome, totalExpense, formatRupiah }) {
  // Calculate category totals
  const expenseTransactions = transactions.filter((t) => t.type === 'expense')
  const categoryTotals = expenseTransactions.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount
    return acc
  }, {})
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  return (
    <div className="pt-8 px-6 pb-[140px] space-y-7">
      {/* Cash Flow Summary */}
      <div className="bg-midnight text-white rounded-[32px] p-8 relative overflow-hidden shadow-2xl shadow-midnight/20">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <h3 className="text-xl font-bold font-jakarta mb-1.5 tracking-tight">Ringkasan Arus Kas</h3>
          <p className="text-white/40 text-[10px] font-extrabold mb-8 tracking-widest uppercase font-jakarta">
            Siklus Berjalan
          </p>
          <div className="space-y-5">
            <div className="flex justify-between items-center border-b border-white/10 pb-5">
              <span className="text-[13.5px] font-medium text-white/60">Pemasukan Kotor</span>
              <span className="text-[19px] font-extrabold font-jakarta">+{formatRupiah(totalIncome)}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-[13.5px] font-medium text-white/60">Pengeluaran Inti</span>
              <span className="text-[19px] font-extrabold font-jakarta text-gold">
                {formatRupiah(totalExpense)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Categories */}
      <div className="bg-white rounded-[32px] p-8 shadow-[0_12px_40px_rgba(0,0,0,0.03)] border border-midnight/5">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-[17px] font-bold font-jakarta text-midnight tracking-tight">
            Kategori Terbesar
          </h3>
        </div>
        <div className="space-y-7">
          {topCategories.length > 0 ? (
            topCategories.map(([cat, amount], idx) => {
              const percentage = totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(0) : 0
              return (
                <div key={cat} className="space-y-3.5 group">
                  <div className="flex items-center gap-4">
                    <div className="w-[52px] h-[52px] rounded-2xl bg-ivory border border-midnight/5 flex items-center justify-center text-midnight shadow-sm group-hover:scale-105 transition-transform">
                      <CategoryIcon category={cat} size={22} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-extrabold text-muted uppercase tracking-widest opacity-60 capitalize">
                        {cat}
                      </p>
                      <p className="text-[16px] font-bold font-jakarta text-midnight mt-0.5">
                        {formatRupiah(amount)}
                      </p>
                    </div>
                    <span className="text-[13px] font-extrabold font-jakarta text-midnight">
                      {percentage}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-cream rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        idx === 0 ? 'bg-gold' : idx === 1 ? 'bg-midnight/70' : 'bg-midnight/40'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })
          ) : (
            <p className="text-[14px] text-muted text-center py-6 font-medium">
              Belum ada analisis data.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
