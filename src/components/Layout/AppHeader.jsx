import { ChevronRight, Wallet } from 'lucide-react'
import KurogiLogo from '../shared/KurogiLogo'

export default function AppHeader({ balance = 0, formatRupiah, onBalanceClick }) {
  return (
    <header className="mx-auto flex w-full max-w-5xl shrink-0 items-center justify-between gap-4 px-5 pb-5 pt-7 font-jakarta sm:px-8 md:hidden lg:px-10">
      <div className="flex min-w-0 items-center gap-3.5">
        <KurogiLogo size={54} className="shadow-sm" />
        <div className="min-w-0">
          <h1 className="truncate text-[18px] font-extrabold leading-tight tracking-tight text-midnight sm:text-[21px]">
            Pocket Kurogi
          </h1>
          <p className="mt-1 truncate text-[12px] font-medium text-muted sm:text-[14px]">
            Asisten Keuangan
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onBalanceClick}
        className="flex min-w-[132px] shrink-0 items-center justify-between gap-2.5 rounded-[16px] border border-midnight/10 bg-white px-3 py-2.5 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all hover:border-emerald-200 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] sm:min-w-[190px] sm:px-4"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 sm:h-10 sm:w-10">
          <Wallet size={20} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold leading-none text-muted sm:text-[12px]">Saldo</span>
          <span className="mt-1 block max-w-[84px] truncate text-[13px] font-extrabold tracking-tight text-midnight sm:max-w-[120px] sm:text-[16px]">
            {formatRupiah ? formatRupiah(balance) : balance}
          </span>
        </span>
        <ChevronRight size={20} className="hidden shrink-0 text-midnight sm:block" />
      </button>
    </header>
  )
}
