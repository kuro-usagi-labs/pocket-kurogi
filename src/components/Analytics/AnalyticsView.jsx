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
  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0
  const expenseRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0

  const summaryCards = [
    {
      label: 'Masuk',
      value: `+${formatRupiah(totalIncome)}`,
      Icon: ArrowUpRight,
      tone: 'accent-soft',
    },
    {
      label: 'Keluar',
      value: formatRupiah(totalExpense),
      Icon: ArrowDownRight,
      tone: 'accent-soft',
    },
    {
      label: 'Tabung',
      value: formatRupiah(totalSavings),
      Icon: PiggyBank,
      tone: 'accent-soft',
    },
    {
      label: 'Transfer',
      value: formatRupiah(transferVolume),
      Icon: Repeat2,
      tone: 'accent-soft',
    },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 pb-7 pt-4 sm:px-6 lg:px-8 md:max-w-none md:px-0 md:pb-0 md:pt-0">
      <div className="md:hidden">
        <div>
          <h2 className="font-jakarta text-[28px] font-extrabold tracking-tight text-midnight sm:text-[32px]">Analitik</h2>
          <p className="mt-1.5 text-[14px] font-semibold text-muted">Ringkasan uang bulan ini.</p>
        </div>

        <section className="rounded-[18px] border border-midnight/[0.08] bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.025)]">
          <p className="font-jakarta text-[14px] font-semibold text-muted">
            Arus kas
          </p>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p
                className={`break-words font-jakarta text-[30px] font-extrabold leading-tight tracking-tight sm:text-[36px] ${
                  netCashflowPositive ? 'text-midnight' : 'text-rose-600'
                }`}
              >
                {netCashflowPositive ? '+' : '-'}
                {formatRupiah(Math.abs(netCashflow))}
              </p>
              <p className="mt-1.5 text-[14px] font-semibold text-muted">
                {netCashflowPositive ? 'Masih positif.' : 'Perlu ditahan.'}
              </p>
            </div>
            <div className="accent-soft rounded-[12px] px-3.5 py-2 font-jakarta text-[12px] font-bold">
              {activeBudgetCount} budget aktif
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {summaryCards.map((item) => {
            const Icon = item.Icon

            return (
              <div key={item.label} className="rounded-[16px] border border-midnight/[0.08] bg-white p-4">
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-[11px] ${item.tone}`}>
                  <Icon size={20} strokeWidth={2.2} />
                </div>
                <p className="font-jakarta text-[13px] font-semibold text-muted">
                  {item.label}
                </p>
                <p className="mt-1.5 break-words font-jakarta text-[14px] font-extrabold leading-tight tracking-tight text-midnight sm:text-[15px]">
                  {item.value}
                </p>
              </div>
            )
          })}
        </div>

        <section className="rounded-[16px] border border-midnight/[0.08] bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.025)] sm:p-5">
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

          <ExpenseCategoryList
            topExpenseCategories={topExpenseCategories}
            budgets={budgets}
            formatRupiah={formatRupiah}
          />
        </section>
      </div>

      <div className="hidden md:block">
        <section className="overflow-hidden rounded-[20px] border border-midnight/[0.08] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.03)]">
          <div className="border-b border-midnight/[0.08] bg-[var(--accent-soft)] px-6 py-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0">
                <p className="font-jakarta text-[11px] font-extrabold  text-muted">
                  Ringkasan bulan ini
                </p>
                <h2 className="mt-3 font-jakarta text-[32px] font-extrabold tracking-tight text-midnight">
                  Arus kas
                </h2>
                <p
                  className={`mt-3 break-words font-jakarta text-[42px] font-extrabold leading-none tracking-tight ${
                    netCashflowPositive ? 'text-midnight' : 'text-rose-600'
                  }`}
                >
                  {netCashflowPositive ? '+' : '-'}
                  {formatRupiah(Math.abs(netCashflow))}
                </p>
              </div>

              <div className="grid w-full max-w-[520px] grid-cols-2 gap-3 xl:grid-cols-4">
                {summaryCards.map((item) => {
                  const Icon = item.Icon

                  return (
                    <div key={item.label} className="rounded-[16px] border border-midnight/[0.08] bg-white p-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${item.tone}`}>
                        <Icon size={20} strokeWidth={2.2} />
                      </div>
                      <p className="mt-3 font-jakarta text-[12px] font-semibold text-muted">{item.label}</p>
                      <p className="mt-1 font-jakarta text-[15px] font-extrabold tracking-tight text-midnight">
                        {item.value}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-6 py-5 lg:grid-cols-3">
            <DesktopInsightTile
              label="Budget aktif"
              value={`${activeBudgetCount}`}
              helper={activeBudgetCount > 0 ? 'aktif' : 'kosong'}
            />
            <DesktopInsightTile
              label="Rasio tabung"
              value={`${Math.round(savingsRate)}%`}
              helper="pemasukan"
            />
            <DesktopInsightTile
              label="Rasio belanja"
              value={`${Math.round(expenseRatio)}%`}
              helper="pemasukan"
            />
          </div>
        </section>

        <section className="mt-5 rounded-[20px] border border-midnight/[0.08] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.03)]">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="font-jakarta text-[11px] font-extrabold  text-muted">
                Pengeluaran
              </p>
              <h3 className="mt-2 font-jakarta text-[26px] font-extrabold tracking-tight text-midnight">
                Kategori dominan
              </h3>
            </div>
            <p className="text-[13px] font-semibold text-muted">
              {topExpenseCategories.length} kategori
            </p>
          </div>

          <ExpenseCategoryList
            topExpenseCategories={topExpenseCategories}
            budgets={budgets}
            formatRupiah={formatRupiah}
            desktop
          />
        </section>
      </div>
    </div>
  )
}

function ExpenseCategoryList({ topExpenseCategories, budgets, formatRupiah, desktop = false }) {
  return (
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
            <div key={cat} className={`py-4 first:pt-0 last:pb-0 ${desktop ? 'md:py-5' : ''}`}>
              <div className="flex items-start gap-3.5">
                <div className={`flex shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600 ${desktop ? 'h-14 w-14' : 'h-12 w-12'}`}>
                  <CategoryIcon category={cat} size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`truncate font-jakarta font-extrabold capitalize text-midnight ${desktop ? 'text-[17px]' : 'text-[15px] sm:text-[16px]'}`}>
                      {cat}
                    </p>
                    {overflow && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[9px] font-extrabold  text-red-600">
                        <AlertCircle size={10} /> Lewat
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p className={`font-jakarta font-extrabold text-midnight ${desktop ? 'text-[15px]' : 'text-[14px]'}`}>
                      {formatRupiah(amount)}
                    </p>
                    {limit > 0 && (
                      <p className="text-[12px] font-medium text-muted">
                        dari {formatRupiah(limit)}
                      </p>
                    )}
                  </div>
                </div>
                <span className={`shrink-0 pt-0.5 font-jakarta font-extrabold text-midnight ${desktop ? 'text-[15px]' : 'text-[14px]'}`}>
                  {limit > 0 ? `${Math.round(usagePercent)}%` : `${displayPercent}%`}
                </span>
              </div>

              <div className={`mt-3 ${desktop ? 'pl-[4.5rem]' : 'pl-[3.25rem]'}`}>
                <div className="h-2 w-full overflow-hidden rounded-full bg-midnight/10">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      overflow ? 'bg-red-500' : usagePercent >= 80 ? 'bg-amber-500' : idx === 0 ? 'bg-orange-700' : 'bg-midnight/70'
                    }`}
                    style={{ width: `${progressWidth}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })
      ) : (
        <div className="rounded-[16px] border border-dashed border-midnight/15 bg-champagne px-5 py-8 text-center">
          <p className="font-jakarta text-[13px] font-bold text-midnight">Belum ada arus kas.</p>
          <p className="mt-1 text-[12px] font-medium text-muted">Catat dari chat.</p>
        </div>
      )}
    </div>
  )
}

function SmallSummary({ label, value, helper }) {
  return (
    <div className="rounded-[12px] border border-midnight/8 bg-champagne px-3.5 py-3">
      <p className="font-jakarta text-[12px] font-semibold text-muted">
        {label}
      </p>
      <p className="mt-1.5 truncate font-jakarta text-[15px] font-extrabold tracking-tight text-midnight">
        {value}
      </p>
      <p className="mt-1 truncate text-[12px] font-medium text-muted">{helper}</p>
    </div>
  )
}

function DesktopInsightTile({ label, value, helper }) {
  return (
    <div className="rounded-[16px] border border-midnight/[0.08] bg-white p-4">
      <p className="font-jakarta text-[11px] font-extrabold  text-muted">
        {label}
      </p>
      <p className="mt-3 font-jakarta text-[26px] font-extrabold tracking-tight text-midnight">
        {value}
      </p>
      <p className="mt-1 text-[13px] font-medium text-muted">{helper}</p>
    </div>
  )
}
