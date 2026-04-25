import { useAuth } from '../../contexts/AuthContext'

const PAGE_COPY = {
  chat: {
    title: 'Chat',
    subtitle: 'Catat transaksi dan tanya arus kas.',
  },
  history: {
    title: 'Histori',
    subtitle: 'Semua transaksi tersimpan.',
  },
  wallets: {
    title: 'Dompet',
    subtitle: 'Saldo, arsip, dan target.',
  },
  analytics: {
    title: 'Analitik',
    subtitle: 'Ringkasan uang bulan ini.',
  },
}

export default function DesktopHeader({ activeTab = 'chat', balance = 0, formatRupiah }) {
  const { user } = useAuth()

  const emailName = user?.email?.split('@')[0] || 'User'
  const displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1)
  const page = PAGE_COPY[activeTab] || PAGE_COPY.chat

  return (
    <header className="sticky top-0 z-30 hidden h-[76px] w-full shrink-0 items-center justify-between border-b border-midnight/8 bg-champagne/88 px-6 font-jakarta backdrop-blur-xl md:flex">
      <div className="min-w-0">
        <h2 className="text-[21px] font-extrabold tracking-tight text-midnight">
          {page.title}
        </h2>
        <p className="mt-0.5 text-[12px] font-semibold text-muted">
          {page.subtitle}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="rounded-lg border border-midnight/8 bg-white px-3.5 py-2 text-right shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">Saldo</p>
          <p className="mt-0.5 text-[14px] font-extrabold tracking-tight text-midnight">
            {formatRupiah ? formatRupiah(balance) : balance}
          </p>
        </div>

        <div className="flex items-center gap-3 border-l border-midnight/8 pl-4">
          <div className="hidden text-right sm:block">
            <p className="text-[13px] font-extrabold text-midnight">{displayName}</p>
            <p className="text-[11px] font-semibold text-muted">Akun</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-midnight text-[17px] font-extrabold text-white">
            {displayName.charAt(0)}
          </div>
        </div>
      </div>
    </header>
  )
}
