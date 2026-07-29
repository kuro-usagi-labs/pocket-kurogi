import { ChevronRight } from 'lucide-react'
import KurogiLogo from '../shared/KurogiLogo'

export default function AppHeader({ balance = 0, formatRupiah, onBalanceClick }) {
  return (
    <header className="mx-auto flex h-[68px] w-full max-w-5xl shrink-0 items-center justify-between gap-3 border-b border-midnight/[0.07] bg-white px-4 font-jakarta backdrop-blur-xl lg:hidden">
      <div className="flex min-w-0 items-center gap-2.5">
        <KurogiLogo size={38} />
        <div className="min-w-0">
          <h1 className="truncate text-[16px] font-bold tracking-[-0.035em] text-midnight">Pocket Kurogi</h1>
          <p className="truncate text-[10px] font-medium text-muted">Uangmu, lebih terarah</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onBalanceClick}
        className="flex min-w-0 items-center gap-2 rounded-[14px] border border-midnight/8 bg-[var(--surface)] px-3 py-2 text-left transition-[border-color,transform] hover:border-orange-200 active:scale-[0.98]"
      >
        <span className="min-w-0">
          <span className="block text-[10px] font-bold text-muted">Saldo</span>
          <span className="money-number block max-w-[112px] truncate text-[13px] font-bold text-midnight">
            {formatRupiah ? formatRupiah(balance) : balance}
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-muted" />
      </button>
    </header>
  )
}
