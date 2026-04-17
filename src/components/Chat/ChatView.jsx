import { useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput'

export default function ChatView({
  messages,
  isTyping,
  onSend,
  formatRupiah,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}) {
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  return (
    <div className="absolute inset-0 h-full w-full">
      {/* Gradient mask */}
      <div className="absolute bottom-[80px] md:bottom-0 left-0 w-full h-[180px] md:h-[140px] bg-gradient-to-t from-champagne via-champagne/90 to-transparent z-30 pointer-events-none" />

      {/* Messages container */}
      <div className="absolute inset-0 overflow-y-auto px-5 md:px-24 pt-6 pb-[260px] md:pb-[160px] scroll-smooth no-scrollbar z-20 flex flex-col max-w-4xl mx-auto w-full">
        {hasMore && (
          <div className="flex justify-center mb-5">
            <button
              type="button"
              onClick={onLoadMore}
              className="px-4 py-2 rounded-full bg-white/80 border border-midnight/10 text-[11px] font-extrabold uppercase tracking-[0.18em] text-midnight/60 font-jakarta shadow-sm hover:bg-white transition-colors"
            >
              {loadingMore ? 'Memuat...' : 'Muat Percakapan Lama'}
            </button>
          </div>
        )}

        <div className="flex justify-center mb-8">
          <span className="px-4 py-1.5 rounded-full bg-cream text-midnight/60 text-[10px] font-extrabold uppercase tracking-[0.25em] font-jakarta shadow-sm">
            Today
          </span>
        </div>

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} formatRupiah={formatRupiah} />
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex w-full mb-6 items-start animate-fade-in">
            <div className="bg-white border border-midnight/5 shadow-[0_8px_32px_rgba(15,23,42,0.04)] rounded-[22px] rounded-bl-[6px] px-5 py-4 flex gap-1.5 items-center justify-center h-[46px]">
              <div className="w-1.5 h-1.5 bg-midnight/40 rounded-full typing-dot" />
              <div className="w-1.5 h-1.5 bg-midnight/40 rounded-full typing-dot" />
              <div className="w-1.5 h-1.5 bg-midnight/40 rounded-full typing-dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* Chat input */}
      <ChatInput onSend={onSend} isTyping={isTyping} />
    </div>
  )
}
