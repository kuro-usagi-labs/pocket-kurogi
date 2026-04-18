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
      style={{ paddingBottom: 'calc(0.9rem + env(safe-area-inset-bottom))' }}
    >
      <nav className="relative isolate w-full max-w-[356px] rounded-[30px] border border-white/75 bg-white/82 p-2.5 flex justify-between items-center gap-1.5 pointer-events-auto backdrop-blur-[24px] shadow-[0_14px_32px_rgba(15,23,42,0.09)] transition-all duration-300">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`group/nav relative z-10 flex items-center justify-center rounded-[22px] shrink-0 overflow-hidden outline-none motion-reduce:transition-none transition-[width,color,transform] duration-[240ms] ease-[cubic-bezier(0.2,0.9,0.24,1)] active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                isActive
                  ? 'h-[56px] px-5 text-white'
                  : 'h-[56px] w-[52px] text-midnight/52 hover:text-midnight/72'
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-0 rounded-[22px] motion-reduce:transition-none transition-[opacity,transform,box-shadow] duration-[240ms] ease-[cubic-bezier(0.2,0.9,0.24,1)] ${
                  isActive
                    ? 'bg-midnight opacity-100 scale-100 shadow-[0_12px_22px_rgba(15,23,42,0.16)]'
                    : 'bg-midnight/0 opacity-0 scale-[0.96]'
                }`}
              />
              <Icon
                size={19}
                strokeWidth={isActive ? 2.4 : 2.1}
                className={`relative z-10 shrink-0 motion-reduce:transition-none transition-[transform,opacity] duration-[220ms] ease-[cubic-bezier(0.2,0.9,0.24,1)] ${
                  isActive
                    ? '-translate-y-[0.5px] opacity-100'
                    : 'translate-y-[0.5px] opacity-[0.96] group-hover/nav:-translate-y-[0.5px] group-hover/nav:opacity-100'
                }`}
              />
              <span
                className={`relative z-10 flex items-center whitespace-nowrap font-jakarta text-[10.5px] font-extrabold uppercase tracking-[0.14em] leading-none motion-reduce:transition-none transition-[max-width,opacity,margin,transform] duration-[260ms] ease-[cubic-bezier(0.2,0.9,0.24,1)] ${
                  isActive ? 'max-w-[88px] opacity-100 ml-2.5 translate-x-0 translate-y-[0.5px]' : 'max-w-0 opacity-0 ml-0 translate-x-[3px] translate-y-[0.5px]'
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
