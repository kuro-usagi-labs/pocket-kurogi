import { BarChart3, Clock3, LogOut, MessageCircle, PiggyBank } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import KurogiLogo from '../shared/KurogiLogo'

const navItems = [
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'history', label: 'Histori', icon: Clock3 },
  { id: 'wallets', label: 'Dompet', icon: PiggyBank },
  { id: 'analytics', label: 'Analitik', icon: BarChart3 },
]

export default function DesktopSidebar({ activeTab, setActiveTab }) {
  const { signOut } = useAuth()

  return (
    <aside className="hidden h-full w-[104px] shrink-0 flex-col bg-champagne px-3 py-4 font-jakarta md:flex">
      <div className="flex justify-center pb-5">
        <KurogiLogo size={54} className="shadow-[0_12px_28px_rgba(232,84,46,0.16)]" />
      </div>

      <nav aria-label="Navigasi utama" className="flex flex-1 flex-col gap-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`group flex min-h-[68px] w-full flex-col items-center justify-center gap-1.5 rounded-[16px] px-2 text-[11px] font-bold transition-[background-color,color,transform] duration-200 active:scale-[0.98] ${
                isActive
                  ? 'bg-midnight text-white shadow-[0_12px_32px_rgba(32,32,35,0.16)]'
                  : 'text-muted hover:bg-white hover:text-midnight'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 1.9} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={signOut}
        aria-label="Keluar dari akun"
        className="mt-3 flex min-h-14 flex-col items-center justify-center gap-1 rounded-[16px] text-[11px] font-bold text-muted transition-colors hover:bg-rose-50 hover:text-rose-600 active:scale-[0.98]"
      >
        <LogOut size={19} strokeWidth={1.9} />
        Keluar
      </button>
    </aside>
  )
}
