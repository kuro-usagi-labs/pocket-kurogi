import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MessageSquare, Clock, Wallet, BarChart3 } from 'lucide-react'

const navItems = [
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'history', icon: Clock, label: 'Histori' },
  { id: 'wallets', icon: Wallet, label: 'Dompet' },
  { id: 'analytics', icon: BarChart3, label: 'Analisa' },
]

export default function BottomDock({ activeTab, onTabChange }) {
  const navRef = useRef(null)
  const itemRefs = useRef({})
  const [highlightStyle, setHighlightStyle] = useState({
    width: 0,
    x: 0,
    ready: false,
  })

  const updateHighlight = useCallback(() => {
    const nav = navRef.current
    const activeButton = itemRefs.current[activeTab]

    if (!nav || !activeButton) {
      return
    }

    const navRect = nav.getBoundingClientRect()
    const buttonRect = activeButton.getBoundingClientRect()

    setHighlightStyle({
      width: buttonRect.width,
      x: buttonRect.left - navRect.left,
      ready: true,
    })
  }, [activeTab])

  useLayoutEffect(() => {
    updateHighlight()
  }, [updateHighlight])

  useEffect(() => {
    updateHighlight()

    const handleResize = () => updateHighlight()
    window.addEventListener('resize', handleResize)

    let observer
    if (typeof ResizeObserver !== 'undefined' && navRef.current) {
      observer = new ResizeObserver(() => updateHighlight())
      observer.observe(navRef.current)
    }

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => updateHighlight()).catch(() => {})
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      observer?.disconnect()
    }
  }, [updateHighlight])

  return (
    <div
      className="absolute bottom-0 left-0 w-full px-4 flex justify-center z-50 pointer-events-none md:hidden"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <nav
        ref={navRef}
        className="relative isolate w-full max-w-[356px] rounded-[30px] border border-white/80 bg-white/80 p-2.5 flex justify-between items-center gap-1.5 pointer-events-auto backdrop-blur-[24px] shadow-[0_20px_44px_rgba(15,23,42,0.12)] transition-all duration-300"
      >
        <div
          aria-hidden="true"
          className={`absolute top-2.5 bottom-2.5 left-2.5 z-0 rounded-[22px] bg-midnight shadow-[0_14px_24px_rgba(15,23,42,0.18)] transition-[transform,width,opacity] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            highlightStyle.ready ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            width: `${highlightStyle.width}px`,
            transform: `translateX(${highlightStyle.x}px)`,
          }}
        >
          <span className="absolute inset-x-[18px] top-[7px] h-[1.5px] rounded-full bg-white/14" />
        </div>

        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              ref={(node) => {
                if (node) {
                  itemRefs.current[item.id] = node
                }
              }}
              onClick={() => onTabChange(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`group/nav relative z-10 flex items-center justify-center rounded-[22px] shrink-0 overflow-hidden outline-none transition-[width,color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.975] focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                isActive
                  ? 'h-[56px] px-5 text-white'
                  : 'h-[56px] w-[52px] bg-transparent text-midnight/40 hover:text-midnight/65'
              }`}
            >
              <Icon
                size={19}
                strokeWidth={isActive ? 2.4 : 2.1}
                className={`shrink-0 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isActive
                    ? '-translate-y-[0.5px] opacity-100'
                    : 'opacity-80 group-hover/nav:-translate-y-[1px] group-hover/nav:opacity-100'
                }`}
              />
              <span
                className={`font-jakarta text-[10.5px] font-extrabold uppercase tracking-[0.14em] whitespace-nowrap transition-[max-width,opacity,margin,transform] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] flex items-center ${
                  isActive ? 'max-w-[88px] opacity-100 ml-2.5 translate-x-0' : 'max-w-0 opacity-0 ml-0 translate-x-1'
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
