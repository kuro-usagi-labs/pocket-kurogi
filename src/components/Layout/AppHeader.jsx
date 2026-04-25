import { ChevronRight, Wallet } from 'lucide-react'
import KurogiLogo from '../shared/KurogiLogo'

export default function AppHeader({ balance = 0, formatRupiah, onBalanceClick }) {
  return (
    <header className="mx-auto flex w-full max-w-5xl shrink-0 items-center justify-between gap-4 px-5 pb-5 pt-7 font-jakarta sm:px-8 lg:px-10">
      <div className="flex min-w-0 items-center gap-3.5">
        <KurogiLogo size={62} className="shadow-sm" />
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-extrabold leading-tight tracking-tight text-midnight sm:text-[25px]">
            Pocket Kurogi
          </h1>
          <p className="mt-1 truncate text-[14px] font-medium text-muted sm:text-[16px]">
            Asisten Keuangan
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onBalanceClick}
        className="flex min-w-[148px] shrink-0 items-center justify-between gap-3 rounded-[18px] border border-midnight/10 bg-white px-3.5 py-3 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all hover:border-emerald-200 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] sm:min-w-[220px] sm:px-5"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 sm:h-11 sm:w-11">
          <Wallet size={23} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold leading-none text-muted sm:text-[14px]">Saldo</span>
          <span className="mt-1 block max-w-[96px] truncate text-[14px] font-extrabold tracking-tight text-midnight sm:max-w-[132px] sm:text-[19px]">
            {formatRupiah ? formatRupiah(balance) : balance}
          </span>
        </span>
        <ChevronRight size={20} className="hidden shrink-0 text-midnight sm:block" />
      </button>
    </header>
  )
}
