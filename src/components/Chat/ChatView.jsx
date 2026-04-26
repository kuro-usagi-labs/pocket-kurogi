import { createElement, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { BarChart3, ClipboardList, PieChart, Plus } from 'lucide-react'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput'

export default function ChatView({
  messages,
  isTyping,
  onSend,
  onNotify,
  formatRupiah,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onNavigate,
}) {
  const containerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const isLoadingOlderRef = useRef(false)
  const previousScrollHeightRef = useRef(0)
  const previousLastMessageIdRef = useRef(messages.at(-1)?.id || null)

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [])

  const handleLoadMore = useCallback(() => {
    if (!onLoadMore || loadingMore) {
      return
    }

    const container = containerRef.current
    if (container) {
      isLoadingOlderRef.current = true
      previousScrollHeightRef.current = container.scrollHeight
    }

    onLoadMore()
  }, [loadingMore, onLoadMore])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) {
      previousLastMessageIdRef.current = messages.at(-1)?.id || null
      return
    }

    if (isLoadingOlderRef.current) {
      const nextScrollHeight = container.scrollHeight
      const heightDelta = nextScrollHeight - previousScrollHeightRef.current
      container.scrollTop += Math.max(heightDelta, 0)
      isLoadingOlderRef.current = false
      previousLastMessageIdRef.current = messages.at(-1)?.id || null
      return
    }

    const lastMessageId = messages.at(-1)?.id || null
    if (lastMessageId && lastMessageId !== previousLastMessageIdRef.current) {
      scrollToBottom()
    }

    previousLastMessageIdRef.current = lastMessageId
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (isTyping) {
      scrollToBottom()
    }
  }, [isTyping, scrollToBottom])

  useEffect(() => {
    if (!loadingMore) {
      isLoadingOlderRef.current = false
      previousScrollHeightRef.current = 0
    }
  }, [loadingMore])

  return (
    <div className="absolute inset-0 h-full w-full">
      <div className="pointer-events-none absolute bottom-[70px] left-0 z-30 h-[145px] w-full bg-gradient-to-t from-white via-white/96 to-transparent md:bottom-0" />

      <div
        ref={containerRef}
        className="no-scrollbar absolute inset-0 z-20 mx-auto flex w-full max-w-5xl flex-col overflow-y-auto scroll-smooth px-4 pb-[200px] pt-1 sm:px-6 md:pb-[150px] lg:px-8"
      >
        <HeroCard />
        <div className="mb-5 grid grid-cols-3 gap-2 sm:mb-6 sm:gap-3">
          <QuickAction
            icon={Plus}
            label="Catat transaksi"
            onClick={() => scrollToBottom()}
          />
          <QuickAction
            icon={PieChart}
            label="Buat budget"
            onClick={() => onNavigate?.('analytics')}
          />
          <QuickAction
            icon={ClipboardList}
            label="Lihat ringkasan"
            onClick={() => onNavigate?.('analytics')}
          />
        </div>

        {hasMore && (
          <div className="mb-5 flex justify-center">
            <button
              type="button"
              onClick={handleLoadMore}
              className="rounded-lg border border-midnight/10 bg-white px-3 py-2 font-jakarta text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted shadow-sm transition-colors hover:text-midnight"
            >
              {loadingMore ? 'Memuat...' : 'Muat lagi'}
            </button>
          </div>
        )}

        <div className="mb-5 flex justify-center">
          <span className="rounded-full border border-midnight/8 bg-white px-4 py-2 font-jakarta text-[12px] font-semibold text-muted shadow-sm">
            Hari ini
          </span>
        </div>

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} formatRupiah={formatRupiah} />
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="mb-6 flex w-full animate-fade-in items-start">
            <div className="flex h-[46px] items-center justify-center gap-1.5 rounded-[22px] border border-midnight/8 bg-white px-5 shadow-sm">
              <div className="typing-dot h-2 w-2 rounded-full bg-emerald-500/70" />
              <div className="typing-dot h-2 w-2 rounded-full bg-emerald-500/70" />
              <div className="typing-dot h-2 w-2 rounded-full bg-emerald-500/70" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      <ChatInput onSend={onSend} isTyping={isTyping} onNotify={onNotify} />
    </div>
  )
}

function HeroCard() {
  return (
    <section className="mb-5 hidden overflow-hidden rounded-[24px] border border-midnight/10 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.04)] sm:block">
      <div className="grid items-center gap-6 sm:grid-cols-[1fr_240px]">
        <div>
          <h2 className="font-jakarta text-[22px] font-extrabold leading-tight tracking-tight text-midnight sm:text-[30px]">
            Halo, saya Kurogi
          </h2>
          <p className="mt-3 max-w-md text-[14px] font-medium leading-relaxed text-muted sm:text-[16px]">
            Asisten keuangan yang bantu catat, analisa, dan rapikan transaksi.
          </p>
        </div>
        <FinanceIllustration />
      </div>
    </section>
  )
}

function QuickAction({ icon: IconComponent, label, onClick }) {

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-[16px] border border-midnight/10 bg-white px-2 py-2.5 text-center font-jakarta text-[11px] font-bold leading-tight text-midnight shadow-[0_8px_22px_rgba(15,23,42,0.04)] transition-all hover:border-emerald-200 hover:bg-emerald-50/40 sm:min-h-[60px] sm:flex-row sm:gap-2.5 sm:px-3.5 sm:py-3 sm:text-[14px]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-emerald-600 text-emerald-600">
        {createElement(IconComponent, { size: 20, strokeWidth: 2.2 })}
      </span>
      <span>{label}</span>
    </button>
  )
}

function FinanceIllustration() {
  return (
    <div className="relative mx-auto hidden h-[172px] w-full max-w-[240px] sm:block">
      <div className="absolute inset-x-2 bottom-0 h-[140px] rounded-[45%] bg-emerald-50" />
      <div className="absolute left-7 top-10 h-28 w-24 rounded-xl border-2 border-slate-300 bg-white shadow-sm">
        <div className="absolute -top-3 left-7 h-5 w-12 rounded-md bg-midnight" />
        <div className="ml-5 mt-6 h-9 w-9 rounded-full bg-emerald-500" />
        <div className="ml-5 mt-5 h-1.5 w-16 rounded-full bg-slate-300" />
        <div className="ml-5 mt-3 flex items-end gap-2">
          <span className="h-8 w-3 rounded-t bg-emerald-300" />
          <span className="h-12 w-3 rounded-t bg-emerald-400" />
          <span className="h-16 w-3 rounded-t bg-emerald-500" />
        </div>
      </div>
      <div className="absolute bottom-10 right-10 h-20 w-28 rounded-xl bg-midnight shadow-xl">
        <div className="absolute right-3 top-8 h-5 w-5 rounded-full bg-emerald-500 ring-4 ring-midnight" />
      </div>
      <div className="absolute bottom-3 right-1 h-14 w-24 rounded-xl bg-emerald-400 shadow-lg">
        <div className="ml-4 mt-4 h-2 w-10 rounded-full bg-white/80" />
        <div className="ml-4 mt-3 h-1.5 w-14 rounded-full bg-midnight" />
      </div>
      <BarChart3 className="absolute right-1 top-6 text-emerald-600/70" size={28} strokeWidth={1.7} />
    </div>
  )
}
