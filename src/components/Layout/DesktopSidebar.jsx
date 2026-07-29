import { BarChart3, Clock3, LogOut, MessageCircle, PiggyBank, Settings2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import KurogiLogo from '../shared/KurogiLogo'

const navItems = [
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'history', label: 'Histori', icon: Clock3 },
  { id: 'wallets', label: 'Dompet', icon: PiggyBank },
  { id: 'analytics', label: 'Analitik', icon: BarChart3 },
  { id: 'settings', label: 'Setelan', icon: Settings2 },
]

export default function DesktopSidebar({ activeTab, setActiveTab }) {
  const { signOut } = useAuth()

  return (
    <aside className="hidden h-full w-[232px] shrink-0 flex-col border-r border-midnight/[0.07] bg-white px-4 py-5 font-jakarta backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-3 px-2 pb-5">
        <KurogiLogo size={46} className="shadow-[0_12px_30px_rgba(199,71,41,0.16)]" />
        <div>
          <p className="text-[15px] font-bold tracking-[-0.03em] text-midnight">Pocket Kurogi</p>
          <p className="mt-0.5 text-[10px] font-semibold text-muted">Teman mengatur uang</p>
        </div>
      </div>

      <div className="mb-4 h-px bg-midnight/[0.07]" />

      <nav aria-label="Navigasi utama" className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative flex min-h-[48px] w-full items-center gap-3 overflow-hidden rounded-[14px] px-3.5 text-[13px] font-bold transition-[background-color,color,transform] duration-200 active:scale-[0.98] ${
                isActive
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                  : 'text-muted hover:bg-champagne hover:text-midnight'
              }`}
            >
              {isActive ? (
                <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[var(--accent)]" aria-hidden="true" />
              ) : null}
              <Icon size={19} strokeWidth={isActive ? 2.3 : 1.9} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={signOut}
        aria-label="Keluar dari akun"
        className="mt-3 flex min-h-12 items-center gap-3 rounded-[14px] border border-transparent px-3.5 text-[13px] font-bold text-muted transition-colors hover:border-red-100 hover:bg-red-50 hover:text-red-600 active:scale-[0.98]"
      >
        <LogOut size={19} strokeWidth={1.9} />
        Keluar
      </button>
    </aside>
  )
}
