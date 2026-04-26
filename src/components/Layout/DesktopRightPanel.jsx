import { ChevronRight, ReceiptText, Sparkles } from 'lucide-react'

export default function DesktopRightPanel({ analytics, transactions = [], onExecuteStrategy }) {
  const {
    totalIncome = 0,
    totalExpense = 0,
    totalSavings = 0,
    netCashflow = 0,
    topExpenseCategories = [],
  } = analytics || {}

  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0
  const liquidityRatio = totalIncome > 0 ? (netCashflow / totalIncome) * 100 : 0
  let healthScore = Math.min(99, Math.max(10, Math.round(savingsRate)))
  if (totalIncome === 0 && totalExpense === 0 && totalSavings === 0) healthScore = 100

  const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(number)
  }

  const topCategory = topExpenseCategories[0]

  return (
    <aside className="hidden h-full w-[292px] shrink-0 flex-col overflow-y-auto overflow-x-hidden rounded-[20px] border border-midnight/[0.08] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)] xl:flex">
      <div className="mb-4">
        <h3 className="font-jakarta text-[12px] font-extrabold uppercase tracking-[0.16em] text-muted">Insight</h3>
      </div>

      <div className="space-y-2.5">
        <section className="rounded-lg border border-midnight/[0.08] bg-champagne p-4">
          <p className="font-jakarta text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
            Skor tabung
          </p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <span className="font-jakarta text-[36px] font-extrabold leading-none tracking-tight text-midnight">
              {healthScore}
            </span>
            <span className={`font-jakarta text-[12px] font-extrabold ${liquidityRatio >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {liquidityRatio >= 0 ? '+' : ''}{liquidityRatio.toFixed(1)}%
            </span>
          </div>
          <p className="mt-2.5 text-[12px] font-semibold text-muted">
            Savings rate {savingsRate.toFixed(1)}%
          </p>
        </section>

        <section className="rounded-lg border border-midnight/[0.08] bg-white p-4">
          <p className="font-jakarta text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
            Pengeluaran
          </p>
          <div className="mt-3 space-y-2.5">
            {topExpenseCategories.slice(0, 3).map((categorySummary, idx) => {
              const cat = categorySummary.name
              const percentage = Math.round(Number(categorySummary.percentage || 0))
              const colors = ['bg-gold', 'bg-indigo-500', 'bg-rose-400']

              return (
                <div key={cat} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`h-3 w-3 shrink-0 rounded-full ${colors[idx] || colors[0]}`} />
                    <span className="truncate text-[12px] font-bold capitalize text-midnight">{cat}</span>
                  </div>
                  <span className="text-[12px] font-extrabold text-muted">{percentage}%</span>
                </div>
              )
            })}
            {topExpenseCategories.length === 0 && (
              <p className="text-[12px] font-medium text-muted">Belum ada data.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg bg-midnight p-4 text-white">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
            <Sparkles size={17} />
          </div>
          <h4 className="font-jakarta text-[15px] font-extrabold tracking-tight">Saran cepat</h4>
          <p className="mt-2 text-[12px] font-medium leading-relaxed text-white/65">
            {topCategory
              ? `${topCategory.name}: hemat ${formatRupiah(Number(topCategory.amount || 0) * 0.2)}.`
              : 'Tanya strategi bulan ini.'}
          </p>
          <button
            onClick={() => onExecuteStrategy('Melihat data saya, apa strategi terbaik untuk mengoptimalkan pengeluaran bulan ini?')}
            className="mt-4 w-full rounded-lg bg-white px-4 py-3 font-jakarta text-[11px] font-extrabold uppercase tracking-[0.12em] text-midnight transition-all hover:bg-champagne active:scale-[0.98]"
          >
            Tanya saran
          </button>
        </section>
      </div>

      <div className="mt-6 pb-6">
        <h4 className="mb-3 font-jakarta text-[12px] font-extrabold uppercase tracking-[0.16em] text-muted">
          Terbaru
        </h4>
        <div className="space-y-2">
          {transactions.slice(0, 4).map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 rounded-lg border border-midnight/[0.08] bg-white p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-champagne text-muted">
                <ReceiptText size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold text-midnight">{tx.desc}</p>
                <p className="mt-0.5 truncate text-[10px] font-semibold text-muted">{formatRupiah(tx.amount)} - {tx.date}</p>
              </div>
              <ChevronRight size={14} className="shrink-0 text-muted/70" />
            </div>
          ))}
          {transactions.length === 0 && (
            <div className="rounded-lg border border-dashed border-midnight/15 bg-champagne px-4 py-5 text-center text-[12px] font-medium text-muted">
              Belum ada transaksi.
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
