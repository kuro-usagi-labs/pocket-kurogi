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
  const composerDraftIdRef = useRef(0)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const [composerDraft, setComposerDraft] = useState(null)
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

  const handleQuickAction = (item) => {
    if (item.action === 'scroll') return handleJumpToLatest()
    if (item.navigateTo) return onNavigate?.(item.navigateTo)
    if (item.action === 'compose' && item.prompt) {
      composerDraftIdRef.current += 1
      setComposerDraft({ id: `${item.id}-${composerDraftIdRef.current}`, text: item.prompt })
      return
    }
    if (item.prompt) onSend(item.prompt)
  }

  return (
    <div className="absolute inset-0 h-full w-full">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="chat-scroll-inset no-scrollbar absolute inset-0 mx-auto flex w-full max-w-[920px] flex-col overflow-y-auto scroll-smooth px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6"
      >
        <SavingsOpening
          balance={balance}
          goals={goals}
          formatRupiah={formatRupiah}
          onNavigate={onNavigate}
          reduceMotion={reduceMotion}
        />

        <div className="no-scrollbar mb-8 flex snap-x gap-2 overflow-x-auto pb-1">
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

        <div className="mb-5 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-midnight/[0.08]" />
          <p className="text-[10px] font-bold text-muted">Percakapan hari ini</p>
          <span className="h-px flex-1 bg-midnight/[0.08]" />
        </div>

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

      <div className="composer-fade pointer-events-none absolute inset-x-0 bottom-0 h-[142px] lg:h-[112px]" />

      {showJumpToLatest ? (
        <button
          type="button"
          aria-label="Lompat ke pesan terbaru"
          onClick={handleJumpToLatest}
          className="chat-latest-inset glass-panel absolute left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full px-3.5 py-2 text-[11px] font-bold text-midnight shadow-premium active:scale-[0.98]"
        >
          <ChevronDown size={15} strokeWidth={2.2} />
          Pesan baru
        </button>
      ) : null}

      <ChatInput
        key={composerDraft?.id || 'composer'}
        onSend={onSend}
        isTyping={isTyping}
        onNotify={onNotify}
        initialValue={composerDraft?.text || ''}
      />
    </div>
  )
}

function SavingsOpening({ balance, goals, formatRupiah, onNavigate, reduceMotion }) {
  const activeGoal = goals[0] || null
  const needsBalanceSetup = !activeGoal && Number(balance || 0) <= 0
  const current = Number(activeGoal?.current_amount || 0)
  const target = Number(activeGoal?.target_amount || 0)
  const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0

  return (
    <Motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="relative mb-4 overflow-hidden rounded-[18px] border border-midnight/[0.08] bg-[var(--accent-soft)] p-5 sm:p-7"
    >
      <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="max-w-[17ch] font-jakarta text-[27px] font-bold leading-[1.05] tracking-[-0.05em] text-midnight sm:text-[36px]">
            {needsBalanceSetup ? 'Mulai dari saldo yang kamu punya.' : 'Mau nabung untuk apa hari ini?'}
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.('wallets')}
            className="mt-5 inline-flex items-center gap-2 whitespace-nowrap rounded-[13px] bg-midnight px-4 py-2.5 text-[13px] font-bold text-white transition-transform active:scale-[0.98]"
          >
            <PiggyBank size={17} strokeWidth={2.1} />
            {needsBalanceSetup ? 'Atur saldo & dompet' : 'Buka tabungan'}
          </button>
        </div>

        <div className="min-w-[210px] rounded-[15px] bg-midnight p-4 text-white shadow-[0_18px_40px_-26px_rgba(0,0,0,0.55)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold text-white/55">
                {needsBalanceSetup ? 'Langkah pertama' : activeGoal?.name || 'Saldo tersedia'}
              </p>
              <p className="money-number mt-1.5 text-[22px] font-bold leading-none">
                {needsBalanceSetup ? 'Isi saldo awal' : formatRupiah(activeGoal ? current : balance)}
              </p>
            </div>
            <Target size={19} className="text-orange-300" strokeWidth={2} />
          </div>
          <p className="mt-4 text-[11px] font-medium text-white/60">
            {needsBalanceSetup
              ? 'Agar transaksi pertama tidak gagal'
              : activeGoal
                ? `${progress}% dari ${formatRupiah(target)}`
                : 'Siap dibagi ke tujuan baru'}
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
      className="flex min-w-[170px] snap-start items-center gap-3 rounded-[14px] border border-midnight/8 bg-white px-3.5 py-3 text-left transition-[border-color,transform] hover:border-gold active:scale-[0.98] disabled:opacity-50"
    >
      <span className="accent-soft flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]">
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
