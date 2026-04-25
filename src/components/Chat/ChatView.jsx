import { useRef, useEffect, useLayoutEffect, useCallback } from 'react'
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
      <div className="pointer-events-none absolute bottom-[62px] left-0 z-30 h-[210px] w-full bg-gradient-to-t from-champagne via-champagne/96 to-transparent md:bottom-0 md:h-[136px]" />

      <div
        ref={containerRef}
        className="no-scrollbar absolute inset-0 z-20 mx-auto flex w-full max-w-4xl flex-col overflow-y-auto scroll-smooth px-4 pb-[220px] pt-5 md:px-8 md:pb-[152px] md:pt-8"
      >
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

        <div className="mb-6 flex justify-center">
          <span className="rounded-full border border-midnight/8 bg-white px-3 py-1.5 font-jakarta text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted shadow-sm">
            Hari ini
          </span>
        </div>

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} formatRupiah={formatRupiah} />
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="mb-6 flex w-full animate-fade-in items-start">
            <div className="flex h-[42px] items-center justify-center gap-1.5 rounded-2xl rounded-bl-md border border-midnight/8 bg-white px-4 shadow-sm">
              <div className="typing-dot h-1.5 w-1.5 rounded-full bg-muted/70" />
              <div className="typing-dot h-1.5 w-1.5 rounded-full bg-muted/70" />
              <div className="typing-dot h-1.5 w-1.5 rounded-full bg-muted/70" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      <ChatInput onSend={onSend} isTyping={isTyping} onNotify={onNotify} />
    </div>
  )
}
