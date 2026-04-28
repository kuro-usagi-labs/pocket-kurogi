import { createElement, useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  ClipboardList,
  Lightbulb,
  MessageSquarePlus,
  Repeat2,
  RotateCcw,
  Sparkles,
  Wallet,
} from 'lucide-react'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput'

const ACTION_ICON_MAP = {
  advice: Lightbulb,
  balance: Wallet,
  cleanup: Sparkles,
  compose: MessageSquarePlus,
  expense: ArrowDownRight,
  help: Sparkles,
  income: ArrowUpRight,
  restore: RotateCcw,
  sparkles: Sparkles,
  summary: ClipboardList,
  transfer: Repeat2,
  wallet: Wallet,
}

function getLastMessageId(messages = []) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return null
  }

  return messages[messages.length - 1]?.id || null
}

export default function ChatView({
  messages,
  isTyping,
  onSend,
  onNotify,
  formatRupiah,
  quickActions = [],
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onNavigate,
  onCardAction,
}) {
  const containerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const isLoadingOlderRef = useRef(false)
  const previousScrollHeightRef = useRef(0)
  const previousLastMessageIdRef = useRef(getLastMessageId(messages))
  const showJumpToLatestRef = useRef(false)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [])

  const setJumpToLatestVisible = useCallback((nextValue) => {
    if (showJumpToLatestRef.current === nextValue) {
      return
    }

    showJumpToLatestRef.current = nextValue
    setShowJumpToLatest(nextValue)
  }, [])

  const handleJumpToLatest = useCallback(() => {
    setJumpToLatestVisible(false)
    scrollToBottom()
  }, [scrollToBottom, setJumpToLatestVisible])

  const updateJumpVisibility = useCallback(() => {
    const container = containerRef.current
    if (!container || isLoadingOlderRef.current) {
      return
    }

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    setJumpToLatestVisible(distanceFromBottom > 360)
  }, [setJumpToLatestVisible])

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

  const handleScroll = useCallback(() => {
    updateJumpVisibility()
  }, [updateJumpVisibility])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) {
      previousLastMessageIdRef.current = getLastMessageId(messages)
      return
    }

    if (isLoadingOlderRef.current) {
      const nextScrollHeight = container.scrollHeight
      const heightDelta = nextScrollHeight - previousScrollHeightRef.current
      container.scrollTop += Math.max(heightDelta, 0)
      isLoadingOlderRef.current = false
      previousLastMessageIdRef.current = getLastMessageId(messages)
      return
    }

    const lastMessageId = getLastMessageId(messages)
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

  const handleQuickAction = useCallback((item) => {
    if (item.action === 'scroll') {
      handleJumpToLatest()
      return
    }

    if (item.navigateTo) {
      onNavigate?.(item.navigateTo)
      return
    }

    if (item.prompt) {
      onSend(item.prompt)
    }
  }, [handleJumpToLatest, onNavigate, onSend])

  return (
    <div className="absolute inset-0 h-full w-full">
      <div className="pointer-events-none absolute bottom-[70px] left-0 z-30 h-[145px] w-full bg-gradient-to-t from-white via-white/96 to-transparent md:bottom-0" />

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="no-scrollbar absolute inset-0 z-20 mx-auto flex w-full max-w-5xl flex-col overflow-y-auto scroll-smooth px-4 pb-[200px] pt-1 sm:px-6 md:pb-[150px] lg:px-8"
      >
        <HeroCard onNavigate={onNavigate} />
        <div className="mb-5 grid grid-cols-2 gap-2 sm:mb-6 sm:grid-cols-4 sm:gap-3">
          {quickActions.map((item) => (
            <QuickAction
              key={item.id}
              iconKey={item.icon}
              label={item.label}
              helper={item.helper}
              disabled={isTyping}
              onClick={() => handleQuickAction(item)}
            />
          ))}
        </div>

        {hasMore && (
          <div className="mb-5 flex justify-center">
            <button
              type="button"
              onClick={handleLoadMore}
              className="rounded-lg border border-midnight/[0.08] bg-white px-3 py-2 font-jakarta text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted transition-colors hover:text-midnight"
            >
              {loadingMore ? 'Memuat...' : 'Muat lagi'}
            </button>
          </div>
        )}

        <div className="mb-5 flex justify-center">
          <span className="rounded-full border border-midnight/[0.06] bg-white px-4 py-2 font-jakarta text-[12px] font-semibold text-muted">
            Hari ini
          </span>
        </div>

        {messages.map((msg, index) => {
          const previousMessage = messages[index - 1]
          const nextMessage = messages[index + 1]
          const isFirstInGroup = previousMessage?.sender !== msg.sender
          const isLastInGroup = nextMessage?.sender !== msg.sender

          return (
            <MessageBubble
              key={msg.id}
              msg={msg}
              formatRupiah={formatRupiah}
              onReply={onSend}
              onCardAction={onCardAction}
              disabled={isTyping}
              isFirstInGroup={isFirstInGroup}
              isLastInGroup={isLastInGroup}
            />
          )
        })}

        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {showJumpToLatest ? (
        <button
          type="button"
          aria-label="Lompat ke pesan terbaru"
          onClick={handleJumpToLatest}
          className="absolute bottom-[198px] left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-midnight/[0.08] bg-white px-3.5 py-2 font-jakarta text-[12px] font-extrabold text-midnight shadow-[0_10px_28px_rgba(15,23,42,0.10)] transition-all hover:border-emerald-200 hover:text-emerald-700 md:bottom-[132px]"
        >
          <ChevronDown size={16} strokeWidth={2.5} />
          Pesan terbaru
        </button>
      ) : null}

      <PromptRail
        actions={quickActions}
        disabled={isTyping}
        onAction={handleQuickAction}
      />
      <ChatInput onSend={onSend} isTyping={isTyping} onNotify={onNotify} />
    </div>
  )
}

function PromptRail({ actions = [], disabled = false, onAction }) {
  const visibleActions = actions.filter((item) => item.prompt || item.navigateTo || item.action).slice(0, 4)

  if (visibleActions.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none absolute bottom-[148px] left-0 z-40 w-full px-3 sm:px-8 md:bottom-[82px]">
      <div className="mx-auto flex w-full max-w-4xl gap-2 overflow-x-auto no-scrollbar">
        {visibleActions.map((item) => {
          const IconComponent = ACTION_ICON_MAP[item.icon] || Sparkles

          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onAction(item)}
              className="pointer-events-auto flex shrink-0 items-center gap-2 rounded-full border border-midnight/[0.08] bg-white/95 px-3 py-2 font-jakarta text-[12px] font-extrabold text-midnight shadow-[0_8px_22px_rgba(15,23,42,0.055)] backdrop-blur transition-all hover:border-emerald-200 hover:bg-emerald-50 disabled:opacity-50"
            >
              {createElement(IconComponent, { size: 16, strokeWidth: 2.4 })}
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="mb-6 flex w-full animate-fade-in items-start">
      <div className="flex items-center gap-3 rounded-[22px] border border-midnight/8 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <div className="typing-dot h-2 w-2 rounded-full bg-emerald-500/70" />
          <div className="typing-dot h-2 w-2 rounded-full bg-emerald-500/70" />
          <div className="typing-dot h-2 w-2 rounded-full bg-emerald-500/70" />
        </div>
        <span className="font-jakarta text-[12px] font-extrabold text-muted">
          Menganalisis input
        </span>
      </div>
    </div>
  )
}

function HeroCard({ onNavigate }) {
  return (
    <section className="mb-5 hidden overflow-hidden rounded-[22px] border border-midnight/[0.08] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.025)] sm:block">
      <div className="grid items-center gap-5 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <p className="font-jakarta text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
            Command center
          </p>
          <h2 className="mt-2 font-jakarta text-[22px] font-extrabold leading-tight tracking-tight text-midnight sm:text-[28px]">
            Catat, koreksi, dan baca arus kas
          </h2>
          <p className="mt-2 max-w-xl text-[13px] font-medium text-muted">
            Jalur tercepat untuk input harian, cek saldo, dan evaluasi keputusan uang tanpa pindah terlalu jauh.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigate?.('history')}
              className="rounded-full border border-midnight/[0.08] bg-white px-3.5 py-2 font-jakarta text-[12px] font-bold text-midnight transition-colors hover:border-emerald-200 hover:text-emerald-700"
            >
              Histori
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('wallets')}
              className="rounded-full border border-midnight/[0.08] bg-white px-3.5 py-2 font-jakarta text-[12px] font-bold text-midnight transition-colors hover:border-emerald-200 hover:text-emerald-700"
            >
              Dompet
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('analytics')}
              className="rounded-full border border-midnight/[0.08] bg-white px-3.5 py-2 font-jakarta text-[12px] font-bold text-midnight transition-colors hover:border-emerald-200 hover:text-emerald-700"
            >
              Analitik
            </button>
          </div>
        </div>
        <FinanceIllustration />
      </div>
    </section>
  )
}

function QuickAction({ iconKey, label, helper, disabled = false, onClick }) {
  const IconComponent = ACTION_ICON_MAP[iconKey] || Wallet

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[72px] items-center gap-2.5 rounded-[14px] border border-midnight/[0.08] bg-white px-3 py-3 text-left font-jakarta leading-tight text-midnight shadow-[0_5px_16px_rgba(15,23,42,0.025)] transition-all hover:border-emerald-200 hover:bg-emerald-50/40 disabled:opacity-60 sm:min-h-[76px]"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 sm:h-9 sm:w-9">
        {createElement(IconComponent, { size: 20, strokeWidth: 2.2 })}
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-extrabold sm:text-[13px]">{label}</span>
        <span className="mt-0.5 block truncate text-[11px] font-semibold text-muted">{helper}</span>
      </span>
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
