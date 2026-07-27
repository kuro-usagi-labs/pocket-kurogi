import { useAuth } from '../../contexts/AuthContext'

const PAGE_COPY = {
  chat: ['Ruang obrolan', 'Bicarakan uangmu seperti bicara dengan teman.'],
  history: ['Jejak uang', 'Semua yang masuk dan keluar, tanpa ribet.'],
  wallets: ['Ruang tabungan', 'Dompet dan tujuan yang sedang kamu kejar.'],
  analytics: ['Pola uang', 'Lihat kebiasaan, bukan sekadar angka.'],
  settings: ['Pengaturan', 'Kelola akun dan kendali atas datamu.'],
}

export default function DesktopHeader({ activeTab = 'chat', balance = 0, formatRupiah }) {
  const { user } = useAuth()
  const emailName = user?.email?.split('@')[0] || 'teman'
  const [title, subtitle] = PAGE_COPY[activeTab] || PAGE_COPY.chat

  return (
    <header className="hidden h-[78px] w-full shrink-0 items-center justify-between px-6 font-jakarta md:flex">
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-muted">Halo, {emailName}</p>
        <div className="mt-1 flex items-baseline gap-3">
          <h1 className="text-[22px] font-bold tracking-[-0.035em] text-midnight">{title}</h1>
          <p className="hidden text-[12px] font-medium text-muted lg:block">{subtitle}</p>
        </div>
      </div>

      <button
        type="button"
        className="rounded-[16px] border border-midnight/8 bg-white px-4 py-2.5 text-right transition-transform active:scale-[0.98]"
      >
        <span className="block text-[10px] font-bold text-muted">Saldo tersedia</span>
        <span className="money-number mt-0.5 block text-[17px] font-bold text-midnight">
          {formatRupiah ? formatRupiah(balance) : balance}
        </span>
      </button>
    </header>
  )
}
