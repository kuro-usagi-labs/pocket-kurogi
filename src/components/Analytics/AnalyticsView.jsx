import { AlertCircle, ArrowDownRight, ArrowUpRight, PiggyBank, Repeat2 } from 'lucide-react'
import { CategoryIcon } from '../shared/CategoryIcon'

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
  const dominantExpense = topExpenseCategories[0] || null
  const activeBudgetCount = budgets.filter((budget) => Number(budget.monthly_limit || 0) > 0).length

  const summaryCards = [
    {
      label: 'Masuk',
      value: `+${formatRupiah(totalIncome)}`,
      Icon: ArrowUpRight,
      tone: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Keluar',
      value: formatRupiah(totalExpense),
      Icon: ArrowDownRight,
      tone: 'text-rose-600 bg-rose-50',
    },
    {
      label: 'Tabung',
      value: formatRupiah(totalSavings),
      Icon: PiggyBank,
      tone: 'text-gold bg-teal-50',
    },
    {
      label: 'Transfer',
      value: formatRupiah(transferVolume),
      Icon: Repeat2,
      tone: 'text-indigo-600 bg-indigo-50',
    },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-5 pb-8 pt-3 sm:px-8 lg:px-10">
      <div>
        <h2 className="font-jakarta text-[34px] font-extrabold tracking-tight text-midnight sm:text-[42px]">Analitik</h2>
        <p className="mt-2 text-[17px] font-medium text-muted">Ringkasan uang bulan ini.</p>
      </div>

      <section className="rounded-[22px] border border-midnight/10 bg-white p-5 shadow-[0_14px_38px_rgba(15,23,42,0.05)] sm:p-7">
        <p className="font-jakarta text-[16px] font-medium text-muted">
          Arus kas
        </p>
        <div className="mt-2.5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p
              className={`break-words font-jakarta text-[38px] font-extrabold leading-tight tracking-tight md:text-[48px] ${
                netCashflowPositive ? 'text-midnight' : 'text-rose-600'
              }`}
            >
              {netCashflowPositive ? '+' : '-'}
              {formatRupiah(Math.abs(netCashflow))}
            </p>
            <p className="mt-2 text-[16px] font-medium text-muted">
              {netCashflowPositive ? 'Masih positif.' : 'Perlu ditahan.'}
            </p>
          </div>
          <div className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 font-jakarta text-[13px] font-bold text-emerald-700">
            {activeBudgetCount} budget aktif
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map((item) => {
          const Icon = item.Icon

          return (
            <div key={item.label} className="rounded-[18px] border border-midnight/10 bg-white p-4 shadow-sm">
              <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-full ${item.tone}`}>
                <Icon size={22} strokeWidth={2.2} />
              </div>
              <p className="font-jakarta text-[14px] font-medium text-muted">
                {item.label}
              </p>
              <p className="mt-1.5 break-words font-jakarta text-[16px] font-extrabold leading-tight tracking-tight text-midnight md:text-[17px]">
                {item.value}
              </p>
            </div>
          )
        })}
      </div>

      <section className="rounded-[22px] border border-midnight/10 bg-white p-4 shadow-[0_14px_38px_rgba(15,23,42,0.05)] sm:p-5">
        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <SmallSummary
            label="Kategori utama"
            value={dominantExpense ? dominantExpense.name : 'Belum ada data'}
            helper={
              dominantExpense
                ? formatRupiah(Number(dominantExpense.amount || 0))
                : 'Mulai catat lewat chat.'
            }
          />
          <SmallSummary
            label="Budget"
            value={`${activeBudgetCount} aktif`}
            helper={`Transfer ${formatRupiah(transferVolume)}`}
          />
        </div>

        <div className="divide-y divide-midnight/8">
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

              return (
                <div key={cat} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <CategoryIcon category={cat} size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-jakarta text-[17px] font-extrabold capitalize text-midnight">
                          {cat}
                        </p>
                        {overflow && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-red-600">
                            <AlertCircle size={10} /> Lewat
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <p className="font-jakarta text-[15px] font-extrabold text-midnight">
                          {formatRupiah(amount)}
                        </p>
                        {limit > 0 && (
                          <p className="text-[13px] font-medium text-muted">
                            dari {formatRupiah(limit)}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 pt-0.5 font-jakarta text-[15px] font-extrabold text-midnight">
                      {limit > 0 ? `${Math.round(usagePercent)}%` : `${displayPercent}%`}
                    </span>
                  </div>

                  <div className="mt-3 pl-[3.625rem]">
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-midnight/10">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          overflow ? 'bg-red-500' : usagePercent >= 80 ? 'bg-amber-500' : idx === 0 ? 'bg-emerald-500' : 'bg-midnight/70'
                        }`}
                        style={{ width: `${progressWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="rounded-[18px] border border-dashed border-midnight/15 bg-champagne px-5 py-8 text-center">
              <p className="font-jakarta text-[13px] font-bold text-midnight">Belum ada arus kas.</p>
              <p className="mt-1 text-[12px] font-medium text-muted">Catat dari chat.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function SmallSummary({ label, value, helper }) {
  return (
    <div className="rounded-[16px] border border-midnight/8 bg-champagne px-4 py-3.5">
      <p className="font-jakarta text-[13px] font-medium text-muted">
        {label}
      </p>
      <p className="mt-2 truncate font-jakarta text-[17px] font-extrabold tracking-tight text-midnight">
        {value}
      </p>
      <p className="mt-1 truncate text-[13px] font-medium text-muted">{helper}</p>
    </div>
  )
}
