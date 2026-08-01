import { useAuth } from '../../contexts/AuthContext'

const PAGE_COPY = {
  chat: ['Ruang obrolan', 'Bicarakan uangmu seperti bicara dengan teman.'],
  history: ['Jejak uang', 'Semua yang masuk dan keluar, tanpa ribet.'],
  wallets: ['Ruang tabungan', 'Dompet dan tujuan yang sedang kamu kejar.'],
  planning: ['Rencana uang', 'Lihat jadwal dan kebiasaan sebelum tanggalnya tiba.'],
  analytics: ['Pola uang', 'Lihat kebiasaan, bukan sekadar angka.'],
  settings: ['Pengaturan', 'Kelola akun dan kendali atas datamu.'],
}

export default function DesktopHeader({ activeTab = 'chat', balance = 0, formatRupiah }) {
  const { user } = useAuth()
  const emailName = user?.email?.split('@')[0] || 'teman'
  const [title, subtitle] = PAGE_COPY[activeTab] || PAGE_COPY.chat

  return (
    <header className="app-content-frame hidden h-[96px] shrink-0 items-center justify-between px-7 font-jakarta lg:flex">
      <div className="flex min-w-0 items-center gap-4">
        <span className="h-10 w-1 rounded-full bg-[var(--accent)]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-[var(--accent-ink)]">Halo, {emailName}</p>
          <h1 className="mt-0.5 text-[25px] font-bold tracking-[-0.045em] text-midnight">{title}</h1>
          <p className="mt-0.5 text-[12px] font-medium text-muted">{subtitle}</p>
        </div>
      </div>

      <button
        type="button"
        className="min-w-[172px] rounded-[16px] border border-midnight/8 bg-white px-4 py-3 text-right shadow-[0_14px_34px_-28px_rgba(25,27,32,0.45)] transition-[border-color,transform] hover:border-orange-200 active:scale-[0.98]"
      >
        <span className="block text-[10px] font-bold text-muted">Saldo tersedia</span>
        <span className="money-number mt-0.5 block text-[17px] font-bold text-midnight">
          {formatRupiah ? formatRupiah(balance) : balance}
        </span>
      </button>
    </header>
  )
}
