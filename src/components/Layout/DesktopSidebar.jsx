import { MessageSquare, LineChart, Wallet, Clock, LogOut } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import KurogiLogo from '../shared/KurogiLogo'

export default function DesktopSidebar({ activeTab, setActiveTab }) {
  const { signOut } = useAuth()

  const navItems = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'history', label: 'Histori', icon: Clock },
    { id: 'wallets', label: 'Dompet', icon: Wallet },
    { id: 'analytics', label: 'Analitik', icon: LineChart },
  ]

  return (
    <aside className="hidden h-full w-[248px] shrink-0 flex-col border-r border-midnight/8 bg-white px-4 py-5 font-jakarta tracking-tight md:flex">
      <div className="mb-7 rounded-[22px] border border-emerald-100 bg-emerald-50/60 px-4 py-4">
        <KurogiLogo size={58} className="shadow-sm" />
        <h1 className="mt-4 text-[20px] font-extrabold tracking-tight text-midnight">Pocket Kurogi</h1>
        <p className="mt-1 text-[12px] font-semibold text-muted">Asisten keuangan</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex w-full items-center gap-3 rounded-[16px] px-3.5 py-3 text-left text-[14px] transition-all ${
                isActive
                  ? 'bg-emerald-500 text-white shadow-[0_12px_26px_rgba(16,185,129,0.22)]'
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
          className="flex w-full items-center gap-3 rounded-[16px] px-3.5 py-3 text-[14px] font-bold text-muted transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={18} />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  )
}
