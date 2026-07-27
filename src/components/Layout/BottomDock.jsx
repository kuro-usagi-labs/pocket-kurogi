import { BarChart3, Clock3, MessageCircle, PiggyBank, Settings2 } from 'lucide-react'

const navItems = [
  { id: 'chat', icon: MessageCircle, label: 'Chat' },
  { id: 'history', icon: Clock3, label: 'Histori' },
  { id: 'wallets', icon: PiggyBank, label: 'Dompet' },
  { id: 'analytics', icon: BarChart3, label: 'Analitik' },
  { id: 'settings', icon: Settings2, label: 'Setelan' },
]

export default function BottomDock({ activeTab, onTabChange }) {
  return (
    <div
      className="pointer-events-none absolute bottom-0 left-0 z-50 flex w-full justify-center px-3 md:hidden"
      style={{ paddingBottom: 'calc(0.65rem + env(safe-area-inset-bottom))' }}
    >
      <nav className="glass-panel pointer-events-auto grid w-full max-w-md grid-cols-5 gap-1 rounded-[20px] p-1.5 shadow-[0_18px_50px_rgba(31,32,38,0.18)]">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[12px] text-[10px] font-bold transition-[background-color,color,transform] active:scale-[0.97] ${
                isActive ? 'bg-midnight text-white' : 'text-muted hover:text-midnight'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.35 : 1.9} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
