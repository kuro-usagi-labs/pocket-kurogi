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
      className="pointer-events-none absolute bottom-0 left-0 z-50 flex w-full justify-center px-3 md:hidden"
      style={{ paddingBottom: 'calc(0.55rem + env(safe-area-inset-bottom))' }}
    >
      <nav className="pointer-events-auto relative isolate flex w-full max-w-[372px] items-center justify-between gap-1 rounded-lg border border-midnight/10 bg-white/94 p-1.5 shadow-[0_14px_32px_rgba(17,24,39,0.11)] backdrop-blur-xl">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`group/nav relative z-10 flex shrink-0 items-center justify-center overflow-hidden rounded-lg outline-none transition-[width,color,transform] duration-200 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                isActive
                  ? 'h-[46px] px-3.5 text-white'
                  : 'h-[46px] w-[46px] text-muted hover:bg-champagne hover:text-midnight'
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-0 rounded-lg transition-[opacity,transform,box-shadow] duration-200 ${
                  isActive
                    ? 'scale-100 bg-midnight opacity-100 shadow-sm'
                    : 'bg-midnight/0 opacity-0 scale-[0.96]'
                }`}
              />
              <Icon
                size={19}
                strokeWidth={isActive ? 2.4 : 2.1}
                className={`relative z-10 shrink-0 transition-[transform,opacity] duration-200 ${
                  isActive
                    ? '-translate-y-[0.5px] opacity-100'
                    : 'translate-y-[0.5px] opacity-[0.96] group-hover/nav:-translate-y-[0.5px] group-hover/nav:opacity-100'
                }`}
              />
              <span
                className={`relative z-10 flex items-center whitespace-nowrap font-jakarta text-[9.5px] font-extrabold uppercase leading-none tracking-[0.09em] transition-[max-width,opacity,margin,transform] duration-200 ${
                  isActive ? 'ml-2 max-w-[70px] translate-x-0 translate-y-[0.5px] opacity-100' : 'ml-0 max-w-0 translate-x-[3px] translate-y-[0.5px] opacity-0'
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
