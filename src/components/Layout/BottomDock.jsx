import { MessageSquare, Clock, Wallet, BarChart3 } from 'lucide-react'

const navItems = [
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'history', icon: Clock, label: 'Histori' },
  { id: 'wallets', icon: Wallet, label: 'Dompet' },
  { id: 'analytics', icon: BarChart3, label: 'Analisa' },
]

export default function BottomDock({ activeTab, onTabChange }) {
  return (
    <div
      className="absolute bottom-0 left-0 w-full px-4 flex justify-center z-50 pointer-events-none md:hidden"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <nav className="w-full max-w-[356px] rounded-[30px] border border-white/80 bg-white/80 p-2.5 flex justify-between items-center gap-1.5 pointer-events-auto backdrop-blur-[24px] shadow-[0_20px_44px_rgba(15,23,42,0.12)] transition-all duration-300">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              aria-label={item.label}
              className={`flex items-center justify-center rounded-[22px] transition-all duration-300 ease-out overflow-hidden shrink-0 ${
                isActive
                  ? 'h-[56px] bg-midnight text-white px-5 shadow-[0_14px_24px_rgba(15,23,42,0.18)]'
                  : 'h-[56px] w-[52px] bg-transparent text-midnight/40 hover:text-midnight'
              }`}
            >
              <Icon size={19} strokeWidth={isActive ? 2.4 : 2.1} className="shrink-0" />
              <span
                className={`font-jakarta text-[10.5px] font-extrabold uppercase tracking-[0.14em] whitespace-nowrap transition-all duration-300 ease-out flex items-center ${
                  isActive ? 'max-w-[88px] opacity-100 ml-2.5' : 'max-w-0 opacity-0 ml-0'
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
