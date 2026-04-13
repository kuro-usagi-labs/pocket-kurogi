import { MessageSquare, Clock, Wallet, BarChart3 } from 'lucide-react'

const navItems = [
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'history', icon: Clock, label: 'Histori' },
  { id: 'wallets', icon: Wallet, label: 'Dompet' },
  { id: 'analytics', icon: BarChart3, label: 'Analisa' },
]

export default function BottomDock({ activeTab, onTabChange }) {
  return (
    <div className="absolute bottom-6 left-0 w-full px-6 flex justify-center z-50 pointer-events-none md:hidden">
      <nav className="w-full max-w-[340px] glass-panel rounded-[24px] p-2 flex justify-between items-center pointer-events-auto transition-all duration-500">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex items-center justify-center rounded-[18px] transition-all duration-500 ease-out overflow-hidden ${
                isActive
                  ? 'bg-midnight text-white px-4 py-2.5 shadow-md shadow-midnight/20'
                  : 'bg-transparent text-muted/50 hover:text-midnight p-2.5 hover:bg-ivory'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
              <span
                className={`font-jakarta text-[10.5px] font-bold uppercase tracking-[0.15em] whitespace-nowrap transition-all duration-500 ease-out flex items-center ${
                  isActive ? 'max-w-[80px] opacity-100 ml-2.5' : 'max-w-0 opacity-0 ml-0'
                }`}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
