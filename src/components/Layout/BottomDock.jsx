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
      className="pointer-events-none absolute bottom-0 left-0 z-50 flex w-full justify-center border-t border-midnight/[0.06] bg-white/96 px-2 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'calc(0.45rem + env(safe-area-inset-bottom))' }}
    >
      <nav className="pointer-events-auto relative isolate grid w-full max-w-3xl grid-cols-4 gap-0 pt-1.5">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`group/nav relative z-10 flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-lg outline-none transition-[color,transform] duration-200 active:scale-[0.98] ${
                isActive
                  ? 'text-emerald-600'
                  : 'text-muted hover:text-midnight'
              }`}
            >
              <Icon
                size={isActive ? 23 : 22}
                strokeWidth={isActive ? 2.35 : 2.05}
                className={`relative z-10 shrink-0 transition-[transform,opacity] duration-200 ${
                  isActive
                    ? '-translate-y-[1px] opacity-100'
                    : 'translate-y-0 opacity-[0.96] group-hover/nav:-translate-y-[1px] group-hover/nav:opacity-100'
                }`}
              />
              <span
                className={`relative z-10 whitespace-nowrap font-jakarta text-[11px] font-semibold leading-none transition-colors duration-200 ${
                  isActive ? 'text-emerald-600' : 'text-muted'
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
