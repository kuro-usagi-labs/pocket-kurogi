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
      <div className="pointer-events-none absolute bottom-[74px] left-0 z-30 h-[160px] w-full bg-gradient-to-t from-white via-white/96 to-transparent" />

      <div
        ref={containerRef}
        className="no-scrollbar absolute inset-0 z-20 mx-auto flex w-full max-w-5xl flex-col overflow-y-auto scroll-smooth px-5 pb-[220px] pt-1 sm:px-8 lg:px-10"
      >
        <HeroCard />
        <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
    <section className="mb-5 overflow-hidden rounded-[28px] border border-midnight/10 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.04)] sm:p-8">
      <div className="grid items-center gap-7 sm:grid-cols-[1fr_280px]">
        <div>
          <h2 className="font-jakarta text-[30px] font-extrabold leading-tight tracking-tight text-midnight sm:text-[38px]">
            Halo, saya Kurogi
          </h2>
          <p className="mt-5 max-w-md text-[18px] font-medium leading-relaxed text-muted sm:text-[20px]">
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
      className="flex min-h-[70px] items-center justify-center gap-3 rounded-[18px] border border-midnight/10 bg-white px-4 py-4 font-jakarta text-[16px] font-bold text-midnight shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition-all hover:border-emerald-200 hover:bg-emerald-50/40"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-emerald-600 text-emerald-600">
        {createElement(IconComponent, { size: 23, strokeWidth: 2.2 })}
      </span>
      <span>{label}</span>
    </button>
  )
}

function FinanceIllustration() {
  return (
    <div className="relative mx-auto h-[210px] w-full max-w-[290px]">
      <div className="absolute inset-x-2 bottom-0 h-[172px] rounded-[45%] bg-emerald-50" />
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
