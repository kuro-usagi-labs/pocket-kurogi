import { ArrowUpRight, MessageCircleMore, ReceiptText, Target } from 'lucide-react'

export default function DesktopRightPanel({
  analytics,
  transactions = [],
  goals = [],
  onExecuteStrategy,
}) {
  const { totalIncome = 0, totalSavings = 0, netCashflow = 0 } = analytics || {}
  const savingsRate = totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0
  const activeGoal = goals[0] || null
  const goalProgress = activeGoal?.target_amount > 0
    ? Math.min(100, Math.round((Number(activeGoal.current_amount || 0) / Number(activeGoal.target_amount)) * 100))
    : 0

  const formatRupiah = (number) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(number || 0))

  return (
    <aside className="app-scrollbar hidden h-full w-[292px] shrink-0 overflow-y-auto pr-1 xl:block 2xl:w-[312px]">
      <section className="overflow-hidden rounded-[20px] bg-midnight p-5 text-white shadow-[0_24px_60px_rgba(31,32,38,0.16)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold text-white/60">Ritme bulan ini</p>
            <p className="money-number mt-2 text-[34px] font-bold leading-none">
              {savingsRate}%
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-white/10 text-orange-300">
            <ArrowUpRight size={22} strokeWidth={2} />
          </div>
        </div>
        <p className="mt-4 max-w-[22ch] text-[12px] font-medium leading-relaxed text-white/65">
          {netCashflow >= 0 ? 'Arus kasmu masih memberi ruang untuk menabung.' : 'Pengeluaran sedang lebih cepat dari pemasukan.'}
        </p>
      </section>

      <section className="surface-card mt-3 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-orange-50 text-orange-600">
            <Target size={20} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-muted">Tujuan terdekat</p>
            <h2 className="truncate font-jakarta text-[15px] font-bold text-midnight">
              {activeGoal?.name || 'Buat target pertama'}
            </h2>
          </div>
        </div>

        {activeGoal ? (
          <div className="mt-5 grid grid-cols-[72px_1fr] items-center gap-4">
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[7px] border-orange-100 bg-orange-50 text-center">
              <span className="money-number text-[18px] font-bold text-orange-700">{goalProgress}%</span>
            </div>
            <div className="min-w-0">
              <p className="money-number truncate text-[16px] font-bold text-midnight">
                {formatRupiah(activeGoal.current_amount)}
              </p>
              <p className="mt-1 text-[11px] font-medium leading-relaxed text-muted">
                Target {formatRupiah(activeGoal.target_amount)}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-[12px] font-medium leading-relaxed text-muted">
            Ceritakan apa yang ingin kamu kumpulkan. Kurogi akan membantu membuat targetnya.
          </p>
        )}
      </section>

      <section className="surface-card mt-3 p-5">
        <h2 className="font-jakarta text-[15px] font-bold text-midnight">Baru terjadi</h2>
        <div className="mt-3">
          {transactions.slice(0, 4).map((transaction, index) => (
            <div
              key={transaction.id}
              className={`flex items-center gap-3 py-3 ${index > 0 ? 'border-t border-midnight/8' : ''}`}
            >
              <ReceiptText size={17} className="shrink-0 text-muted" strokeWidth={1.8} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold text-midnight">{transaction.desc}</p>
                <p className="money-number mt-0.5 truncate text-[11px] font-medium text-muted">
                  {formatRupiah(transaction.amount)}
                </p>
              </div>
            </div>
          ))}
          {transactions.length === 0 ? (
            <p className="py-3 text-[12px] font-medium text-muted">Belum ada transaksi.</p>
          ) : null}
        </div>
      </section>

      <button
        type="button"
        onClick={() => onExecuteStrategy('Melihat data saya, apa satu langkah menabung yang paling realistis untuk minggu ini?')}
        className="mt-3 flex w-full items-center justify-between rounded-[18px] bg-orange-700 px-5 py-4 text-left text-white shadow-[0_16px_36px_rgba(199,71,41,0.2)] transition-[background-color,transform] hover:bg-[var(--accent-hover)] active:scale-[0.98]"
      >
        <span>
          <span className="block text-[11px] font-bold text-white/75">Butuh arah?</span>
          <span className="mt-0.5 block font-jakarta text-[14px] font-bold">Tanya langkah berikutnya</span>
        </span>
        <MessageCircleMore size={21} strokeWidth={2} />
      </button>
    </aside>
  )
}
