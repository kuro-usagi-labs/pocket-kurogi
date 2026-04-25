import { MessageSquare, LineChart, Wallet, Clock, LogOut } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function DesktopSidebar({ activeTab, setActiveTab }) {
  const { signOut } = useAuth()

  const navItems = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'history', label: 'Histori', icon: Clock },
    { id: 'wallets', label: 'Dompet', icon: Wallet },
    { id: 'analytics', label: 'Analitik', icon: LineChart },
  ]

  return (
    <aside className="hidden md:flex h-full w-[228px] shrink-0 flex-col border-r border-midnight/8 bg-white px-4 py-5 font-jakarta tracking-tight">
      <div className="mb-7 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-midnight text-[15px] font-extrabold text-white shadow-premium">
          PK
        </div>
        <h1 className="mt-4 text-[19px] font-extrabold tracking-tight text-midnight">Pocket Kurogi</h1>
        <p className="mt-1 text-[12px] font-semibold text-muted">Catat. Tanya. Rapikan.</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] transition-all ${
                isActive
                  ? 'bg-midnight text-white shadow-premium'
                  : 'text-muted hover:bg-champagne hover:text-midnight'
              }`}
            >
              <Icon size={18} strokeWidth={2.1} />
              <span className="font-bold">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="mt-auto border-t border-midnight/8 pt-4">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-bold text-muted transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={18} />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  )
}
