import { MessageSquare, LineChart, Wallet, Settings, HelpCircle, LogOut } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function DesktopSidebar({ activeTab, setActiveTab }) {
  const { signOut } = useAuth()

  const navItems = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'stats', label: 'Insights', icon: LineChart },
    { id: 'wallets', label: 'Budgets', icon: Wallet },
    { id: 'profile', label: 'Settings', icon: Settings },
  ]

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-[#faf9f4] py-8 z-40 border-r border-midnight/5 font-jakarta tracking-tight">
      <div className="mb-12 px-8">
        <h1 className="text-xl font-bold tracking-tighter text-midnight">The Vault</h1>
        <p className="text-[10px] text-midnight/50 font-bold tracking-[0.2em] uppercase mt-1">Pocket Kurogi</p>
      </div>

      <nav className="flex-1 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 px-8 py-4 w-full text-left transition-all duration-300 border-r-2 ${
                isActive 
                  ? 'text-midnight font-bold border-gold bg-midnight/5' 
                  : 'text-midnight/50 font-medium border-transparent hover:bg-midnight/5 hover:text-midnight/80'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-midnight' : 'text-midnight/50'} />
              <span className="text-sm">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="px-8 mt-auto flex flex-col gap-1">
        <button className="flex items-center gap-3 py-3 text-midnight/50 font-medium hover:text-midnight transition-colors">
          <HelpCircle size={20} />
          <span className="text-sm">Help</span>
        </button>
        <button 
          onClick={signOut}
          className="flex items-center gap-3 py-3 text-midnight/50 font-medium hover:text-red-600 transition-colors"
        >
          <LogOut size={20} />
          <span className="text-sm">Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
