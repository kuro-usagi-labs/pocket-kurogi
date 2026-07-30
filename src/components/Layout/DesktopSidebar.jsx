import { BarChart3, ChevronLeft, ChevronRight, Clock3, LogOut, MessageCircle, PiggyBank, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import KurogiLogo from '../shared/KurogiLogo'

const navItems = [
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'history', label: 'Histori', icon: Clock3 },
  { id: 'wallets', label: 'Dompet', icon: PiggyBank },
  { id: 'analytics', label: 'Analitik', icon: BarChart3 },
  { id: 'settings', label: 'Setelan', icon: Settings2 },
]

export default function DesktopSidebar({ activeTab, setActiveTab }) {
  const { signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(() => (
    typeof window !== 'undefined' &&
    window.localStorage.getItem('pocket-kurogi:desktop-sidebar-collapsed') === 'true'
  ))

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current
      window.localStorage.setItem('pocket-kurogi:desktop-sidebar-collapsed', String(next))
      return next
    })
  }

  return (
    <aside
      className={`hidden h-full shrink-0 flex-col overflow-hidden border-r border-midnight/[0.07] bg-white py-5 font-jakarta backdrop-blur-xl transition-[width,padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none lg:flex ${
        collapsed ? 'w-[76px] px-3' : 'w-[232px] px-4'
      }`}
    >
      <div className={`flex items-center pb-5 ${collapsed ? 'justify-center' : 'gap-3 px-2'}`}>
        <KurogiLogo size={46} className="shrink-0 shadow-[0_12px_30px_rgba(199,71,41,0.16)]" />
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold tracking-[-0.03em] text-midnight">Pocket Kurogi</p>
            <p className="mt-0.5 text-[10px] font-semibold text-muted">Teman mengatur uang</p>
          </div>
        ) : null}
        {!collapsed ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Ciutkan sidebar"
            title="Ciutkan sidebar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-champagne hover:text-midnight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:scale-[0.96]"
          >
            <ChevronLeft size={17} strokeWidth={2.2} />
          </button>
        ) : null}
      </div>

      {collapsed ? (
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label="Lebarkan sidebar"
          title="Lebarkan sidebar"
          className="mb-4 flex h-9 w-full items-center justify-center rounded-[11px] text-muted transition-colors hover:bg-champagne hover:text-midnight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:scale-[0.96]"
        >
          <ChevronRight size={17} strokeWidth={2.2} />
        </button>
      ) : (
        <div className="mb-4 h-px bg-midnight/[0.07]" />
      )}

      <nav aria-label="Navigasi utama" className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative flex min-h-[48px] w-full items-center overflow-hidden rounded-[14px] text-[13px] font-bold transition-[background-color,color,transform] duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                collapsed ? 'justify-center px-2' : 'gap-3 px-3.5'
              } ${
                isActive
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                  : 'text-muted hover:bg-champagne hover:text-midnight'
              }`}
            >
              {isActive ? (
                <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[var(--accent)]" aria-hidden="true" />
              ) : null}
              <Icon size={19} strokeWidth={isActive ? 2.3 : 1.9} />
              {collapsed ? <span className="sr-only">{item.label}</span> : <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={signOut}
        aria-label="Keluar dari akun"
        title={collapsed ? 'Keluar dari akun' : undefined}
        className={`mt-3 flex min-h-12 items-center rounded-[14px] border border-transparent text-[13px] font-bold text-muted transition-colors hover:border-red-100 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 active:scale-[0.98] ${
          collapsed ? 'justify-center px-2' : 'gap-3 px-3.5'
        }`}
      >
        <LogOut size={19} strokeWidth={1.9} />
        {collapsed ? <span className="sr-only">Keluar</span> : 'Keluar'}
      </button>
    </aside>
  )
}
