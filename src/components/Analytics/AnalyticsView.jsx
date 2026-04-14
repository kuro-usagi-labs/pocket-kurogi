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

  const netCashflowPositive = netCashflow >= 0
  const netCashflowHeadline = netCashflowPositive ? 'Arus kas masih sehat' : 'Arus kas sedang ketat'
  const netCashflowCaption = netCashflowPositive
    ? 'Pemasukan masih menutup pengeluaran inti dan alokasi tabungan.'
    : 'Pengeluaran inti dan tabungan sudah lebih tinggi dari pemasukan yang tercatat.'
  const dominantExpense = topExpenseCategories[0] || null
  const activeBudgetCount = budgets.filter((budget) => Number(budget.monthly_limit || 0) > 0).length

  const summaryCards = [
    {
      label: 'Pemasukan',
      value: `+${formatRupiah(totalIncome)}`,
      tone: 'text-white',
    },
    {
      label: 'Pengeluaran',
      value: formatRupiah(totalExpense),
      tone: 'text-gold',
    },
    {
      label: 'Tabungan',
      value: formatRupiah(totalSavings),
      tone: 'text-[#BFE89E]',
    },
    {
      label: 'Transfer Internal',
      value: formatRupiah(transferVolume),
      tone: 'text-white/72',
    },
  ]

  return (
    <div className="pt-6 px-4 pb-[136px] md:pt-8 md:px-6 md:pb-[140px] space-y-5 md:space-y-7 max-w-5xl mx-auto">
      {/* Cash Flow Summary */}
      <div className="bg-midnight text-white rounded-[28px] md:rounded-[32px] p-5 sm:p-6 md:p-8 relative overflow-hidden shadow-2xl shadow-midnight/20">
        <div className="absolute -right-12 -top-12 w-44 h-44 md:w-48 md:h-48 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-0 bottom-0 w-full h-32 bg-gradient-to-t from-white/[0.03] to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-[18px] sm:text-[19px] md:text-xl font-bold font-jakarta tracking-tight">
                Ringkasan Arus Kas
              </h3>
              <p className="text-white/42 text-[10px] font-extrabold mt-1 tracking-[0.18em] uppercase font-jakarta">
                Seluruh Ledger Tercatat
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.05] p-4 sm:p-5 md:p-6 backdrop-blur-sm">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/45 font-jakarta">
              Net Cashflow
            </p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p
                  className={`text-[30px] sm:text-[34px] md:text-[40px] leading-none font-jakarta font-extrabold tracking-tight ${
                    netCashflowPositive ? 'text-white' : 'text-rose-200'
                  }`}
                >
                  {netCashflowPositive ? '+' : '-'}
                  {formatRupiah(Math.abs(netCashflow))}
                </p>
                <p className="mt-2 text-[12.5px] sm:text-[13px] text-white/68 font-medium leading-relaxed max-w-[32rem]">
                  {netCashflowCaption}
                </p>
              </div>
              <div
                className={`hidden sm:flex shrink-0 rounded-full px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.18em] font-jakarta border ${
                  netCashflowPositive
                    ? 'bg-white/[0.08] border-white/10 text-white/72'
                    : 'bg-rose-400/10 border-rose-300/20 text-rose-100'
                }`}
              >
                {netCashflowHeadline}
              </div>
            </div>
            <div
              className={`sm:hidden mt-3 inline-flex rounded-full px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.18em] font-jakarta border ${
                netCashflowPositive
                  ? 'bg-white/[0.08] border-white/10 text-white/72'
                  : 'bg-rose-400/10 border-rose-300/20 text-rose-100'
              }`}
            >
              {netCashflowHeadline}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {summaryCards.map((item) => (
              <div
                key={item.label}
                className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3.5 sm:px-5 sm:py-4 backdrop-blur-sm"
              >
                <p className="text-[9px] sm:text-[9.5px] font-extrabold uppercase tracking-[0.18em] text-white/42 font-jakarta">
                  {item.label}
                </p>
                <p className={`mt-2 text-[15px] sm:text-[17px] md:text-[18px] leading-tight font-jakarta font-extrabold tracking-tight ${item.tone}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Categories & Budgets */}
      <div className="bg-white rounded-[28px] md:rounded-[32px] p-5 sm:p-6 md:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.03)] border border-midnight/5">
        <div className="flex flex-col gap-4 mb-6 md:mb-8">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:items-start">
            <h3 className="text-[17px] font-bold font-jakarta text-midnight tracking-tight">
              Analisa Budget
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-[20px] bg-ivory/70 border border-midnight/5 px-4 py-3.5">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-midnight/42 font-jakarta">
                Kategori Terbesar
              </p>
              <p className="mt-2 text-[15px] font-jakarta font-bold text-midnight tracking-tight">
                {dominantExpense ? dominantExpense.name : 'Belum ada data'}
              </p>
              <p className="mt-1 text-[11.5px] text-midnight/45">
                {dominantExpense
                  ? `${formatRupiah(Number(dominantExpense.amount || 0))} dari total pengeluaran inti`
                  : 'Riwayat pengeluaran akan muncul di sini setelah ledger bertambah.'}
              </p>
            </div>

            <div className="rounded-[20px] bg-ivory/70 border border-midnight/5 px-4 py-3.5">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-midnight/42 font-jakarta">
                Budget Aktif
              </p>
              <p className="mt-2 text-[15px] font-jakarta font-bold text-midnight tracking-tight">
                {activeBudgetCount} kategori terjaga
              </p>
              <p className="mt-1 text-[11.5px] text-midnight/45">
                Transfer internal {formatRupiah(transferVolume)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-0">
          {topExpenseCategories.length > 0 ? (
            topExpenseCategories.slice(0, 5).map((categorySummary, idx) => {
              const cat = categorySummary.name
              const amount = Number(categorySummary.amount || 0)
              const categoryBudget = budgets.find((budget) => budget.categories?.name === cat)
              const limit = categoryBudget?.monthly_limit || 0
              const usagePercent = limit > 0 ? (amount / limit) * 100 : 0
              const overflow = limit > 0 && amount > limit
              const displayPercent = Math.round(Number(categorySummary.percentage || 0))
              const progressWidth = Math.min(100, limit > 0 ? usagePercent : displayPercent)
              const statusCopy = limit > 0
                ? overflow
                  ? 'Sudah melewati batas budget.'
                  : usagePercent >= 80
                    ? 'Mulai mendekati batas budget.'
                    : 'Masih berada dalam batas aman.'
                : `${displayPercent}% dari total pengeluaran inti.`

              return (
                <div
                  key={cat}
                  className={`group py-4 sm:py-5 ${idx !== topExpenseCategories.slice(0, 5).length - 1 ? 'border-b border-midnight/6' : ''}`}
                >
                  <div className="flex items-start gap-3.5 sm:gap-4">
                    <div className="w-11 h-11 sm:w-[52px] sm:h-[52px] rounded-2xl bg-ivory border border-midnight/5 flex items-center justify-center text-midnight shadow-sm group-hover:scale-105 transition-transform shrink-0">
                      <CategoryIcon category={cat} size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[10px] font-extrabold text-muted uppercase tracking-widest opacity-60 capitalize">
                          {cat}
                        </p>
                        {overflow && (
                          <span className="flex items-center gap-1 text-[9px] font-extrabold text-red-500 uppercase tracking-tighter">
                            <AlertCircle size={10} /> Over Budget
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mt-1.5">
                        <p className="text-[15px] sm:text-[16px] font-bold font-jakarta text-midnight">
                          {formatRupiah(amount)}
                        </p>
                        {limit > 0 && (
                          <p className="text-[11px] font-medium text-midnight/30">
                            dari {formatRupiah(limit)}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-[12px] sm:text-[13px] font-extrabold font-jakarta text-midnight shrink-0 pt-0.5">
                      {limit > 0 ? `${Math.round(usagePercent)}%` : `${displayPercent}%`}
                    </span>
                  </div>

                  <div className="mt-3 pl-[3.625rem] sm:pl-[4.25rem]">
                    <div className="w-full h-2 bg-cream rounded-full overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          overflow ? 'bg-red-500' :
                          usagePercent >= 80 ? 'bg-orange-400' :
                          idx === 0 ? 'bg-gold' : 'bg-midnight/70'
                        }`}
                        style={{ width: `${progressWidth}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-midnight/42 leading-relaxed">
                      {statusCopy}
                    </p>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="rounded-[22px] bg-ivory/60 border border-midnight/5 px-5 py-6 text-center">
              <p className="text-[13.5px] text-midnight/68 font-medium">
                Belum ada arus kas yang terekam.
              </p>
              <p className="mt-1.5 text-[11.5px] text-midnight/42 leading-relaxed">
                Setelah transaksi mulai tercatat, kategori pengeluaran terbesar akan muncul di sini.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
