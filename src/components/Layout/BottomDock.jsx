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
      className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex w-full justify-center px-2.5 pb-2 lg:hidden"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <nav className="bottom-dock-surface pointer-events-auto grid h-[64px] w-full max-w-md grid-cols-5 gap-0.5 rounded-[20px] border border-midnight/[0.09] p-1.5 shadow-[0_18px_48px_-22px_rgba(22,24,28,0.42)] backdrop-blur-xl">
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
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[14px] px-0.5 text-[9px] font-bold transition-[background-color,color,transform] active:scale-[0.97] ${
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
