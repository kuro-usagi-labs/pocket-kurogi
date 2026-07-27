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
      className="bottom-dock-surface pointer-events-none absolute bottom-0 left-0 z-50 flex w-full justify-center border-t border-midnight/[0.08] px-1.5 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <nav className="pointer-events-auto grid h-[68px] w-full max-w-md grid-cols-5 gap-0.5 py-1.5">
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
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-[12px] px-0.5 text-[10px] font-bold transition-[background-color,color,transform] active:scale-[0.97] ${
                isActive ? 'accent-soft' : 'text-muted hover:text-midnight'
              }`}
            >
              <Icon size={19} strokeWidth={isActive ? 2.35 : 1.9} />
              <span className="w-full truncate text-center">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
