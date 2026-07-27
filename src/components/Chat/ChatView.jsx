import { createElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  CircleHelp,
  Lightbulb,
  MessageCircleMore,
  PiggyBank,
  Repeat2,
  RotateCcw,
  Sparkles,
  Target,
  Wallet,
} from 'lucide-react'
import { motion as Motion, useReducedMotion } from 'motion/react'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput'

const ACTION_ICON_MAP = {
  advice: Lightbulb,
  balance: Wallet,
  cleanup: Sparkles,
  compose: MessageCircleMore,
  expense: ArrowDownRight,
  help: CircleHelp,
  income: ArrowUpRight,
  restore: RotateCcw,
  sparkles: Sparkles,
  summary: PiggyBank,
  transfer: Repeat2,
  wallet: Wallet,
}

function getLastMessageId(messages = []) {
  return Array.isArray(messages) && messages.length > 0
    ? messages[messages.length - 1]?.id || null
    : null
}

export default function ChatView({
  messages,
  isTyping,
  onSend,
  onNotify,
  formatRupiah,
  quickActions = [],
  goals = [],
  balance = 0,
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
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const reduceMotion = useReducedMotion()

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [])

  const handleJumpToLatest = useCallback(() => {
    setShowJumpToLatest(false)
    scrollToBottom()
  }, [scrollToBottom])

  const handleLoadMore = useCallback(() => {
    if (!onLoadMore || loadingMore) return

    const container = containerRef.current
    if (container) {
      isLoadingOlderRef.current = true
      previousScrollHeightRef.current = container.scrollHeight
    }
    onLoadMore()
  }, [loadingMore, onLoadMore])

  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container || isLoadingOlderRef.current) return
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight
    setShowJumpToLatest(distance > 360)
  }, [])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    if (isLoadingOlderRef.current) {
      const heightDelta = container.scrollHeight - previousScrollHeightRef.current
      container.scrollTop += Math.max(heightDelta, 0)
      isLoadingOlderRef.current = false
    } else {
      const lastMessageId = getLastMessageId(messages)
      if (lastMessageId && lastMessageId !== previousLastMessageIdRef.current) {
        scrollToBottom()
      }
      previousLastMessageIdRef.current = lastMessageId
    }
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (isTyping) scrollToBottom()
  }, [isTyping, scrollToBottom])

  useEffect(() => {
    if (!loadingMore) {
      isLoadingOlderRef.current = false
      previousScrollHeightRef.current = 0
    }
  }, [loadingMore])

  const handleQuickAction = useCallback((item) => {
    if (item.action === 'scroll') return handleJumpToLatest()
    if (item.navigateTo) return onNavigate?.(item.navigateTo)
    if (item.prompt) onSend(item.prompt)
  }, [handleJumpToLatest, onNavigate, onSend])

  return (
    <div className="absolute inset-0 h-full w-full">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="no-scrollbar absolute inset-0 mx-auto flex w-full max-w-4xl flex-col overflow-y-auto scroll-smooth px-4 pb-[178px] pt-2 sm:px-6 md:pb-[130px] lg:px-8"
      >
        <SavingsOpening
          balance={balance}
          goals={goals}
          formatRupiah={formatRupiah}
          onNavigate={onNavigate}
          reduceMotion={reduceMotion}
        />

        <div className="no-scrollbar mb-7 flex snap-x gap-2 overflow-x-auto pb-1">
          {quickActions.slice(0, 5).map((item) => (
            <QuickAction
              key={item.id}
              item={item}
              disabled={isTyping}
              onClick={() => handleQuickAction(item)}
            />
          ))}
        </div>

        {hasMore ? (
          <button
            type="button"
            onClick={handleLoadMore}
            className="mb-6 self-center text-[11px] font-bold text-muted underline decoration-midnight/20 underline-offset-4 transition-colors hover:text-midnight"
          >
            {loadingMore ? 'Mengambil pesan lama...' : 'Lihat pesan sebelumnya'}
          </button>
        ) : null}

        <p className="mb-5 text-center text-[11px] font-bold text-muted">Percakapan hari ini</p>

        {messages.map((message, index) => {
          const previousMessage = messages[index - 1]
          const nextMessage = messages[index + 1]

          return (
            <Motion.div
              key={message.id}
              initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            >
              <MessageBubble
                msg={message}
                formatRupiah={formatRupiah}
                onReply={onSend}
                onCardAction={onCardAction}
                disabled={isTyping}
                isFirstInGroup={previousMessage?.sender !== message.sender}
                isLastInGroup={nextMessage?.sender !== message.sender}
              />
            </Motion.div>
          )
        })}

        {isTyping ? <TypingIndicator /> : null}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[166px] bg-gradient-to-t from-white via-white/95 to-transparent md:h-[122px]" />

      {showJumpToLatest ? (
        <button
          type="button"
          aria-label="Lompat ke pesan terbaru"
          onClick={handleJumpToLatest}
          className="glass-panel absolute bottom-[170px] left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full px-3.5 py-2 text-[11px] font-bold text-midnight shadow-premium active:scale-[0.98] md:bottom-[116px]"
        >
          <ChevronDown size={15} strokeWidth={2.2} />
          Pesan baru
        </button>
      ) : null}

      <ChatInput onSend={onSend} isTyping={isTyping} onNotify={onNotify} />
    </div>
  )
}

function SavingsOpening({ balance, goals, formatRupiah, onNavigate, reduceMotion }) {
  const activeGoal = goals[0] || null
  const current = Number(activeGoal?.current_amount || 0)
  const target = Number(activeGoal?.target_amount || 0)
  const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0

  return (
    <Motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="paper-grid relative mb-4 overflow-hidden rounded-[20px] border border-midnight/8 bg-white p-5 sm:p-6"
    >
      <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="max-w-[16ch] font-jakarta text-[25px] font-bold leading-[1.05] tracking-[-0.05em] text-midnight sm:text-[34px]">
            Mau nabung untuk apa hari ini?
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.('wallets')}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-orange-700 px-4 py-2.5 text-[12px] font-bold text-white transition-transform active:scale-[0.98]"
          >
            <PiggyBank size={17} strokeWidth={2.1} />
            Buka tabungan
          </button>
        </div>

        <div className="min-w-[190px] rounded-[16px] bg-midnight p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold text-white/55">{activeGoal?.name || 'Saldo tersedia'}</p>
              <p className="money-number mt-1.5 text-[22px] font-bold leading-none">
                {formatRupiah(activeGoal ? current : balance)}
              </p>
            </div>
            <Target size={19} className="text-orange-300" strokeWidth={2} />
          </div>
          <p className="mt-4 text-[11px] font-medium text-white/60">
            {activeGoal ? `${progress}% dari ${formatRupiah(target)}` : 'Siap dibagi ke tujuan baru'}
          </p>
        </div>
      </div>
    </Motion.section>
  )
}

function QuickAction({ item, disabled, onClick }) {
  const Icon = ACTION_ICON_MAP[item.icon] || Sparkles

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-w-[168px] snap-start items-center gap-3 rounded-[16px] border border-midnight/8 bg-white px-3.5 py-3 text-left transition-[border-color,transform] hover:border-orange-300 active:scale-[0.98] disabled:opacity-50"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-orange-50 text-orange-600">
        {createElement(Icon, { size: 18, strokeWidth: 2 })}
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-bold text-midnight">{item.label}</span>
        <span className="mt-0.5 block truncate text-[10px] font-medium text-muted">{item.helper}</span>
      </span>
    </button>
  )
}

function TypingIndicator() {
  return (
    <div className="mb-6 flex items-center gap-2.5 text-muted">
      <div className="flex items-center gap-1 rounded-[16px] border border-midnight/8 bg-white px-3 py-2.5">
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-orange-700" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-orange-700" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-orange-700" />
      </div>
      <span className="text-[11px] font-bold">Kurogi sedang berpikir</span>
    </div>
  )
}
