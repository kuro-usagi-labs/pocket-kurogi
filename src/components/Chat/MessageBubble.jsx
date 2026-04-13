import { CategoryIcon } from '../shared/CategoryIcon'

export default function MessageBubble({ msg, formatRupiah }) {
  const isUser = msg.sender === 'user'

  return (
    <div className={`flex flex-col w-full mb-6 animate-fade-in ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`relative max-w-[85%] text-[14.5px] leading-relaxed transition-all duration-300 ${
          isUser
            ? 'px-5 py-4 md:px-6 md:py-4 bg-midnight text-white rounded-[22px] rounded-br-[6px] shadow-[0_8px_20px_rgba(15,23,42,0.15)]'
            : 'px-5 py-4 md:p-8 bg-white text-midnight rounded-[22px] rounded-bl-[6px] border border-midnight/5 shadow-[0_8px_32px_rgba(15,23,42,0.04)]'
        }`}
      >
        {msg.image && (
          <div className="mb-3 rounded-xl overflow-hidden border border-white/10 shadow-sm">
            <img src={msg.image} alt="Uploaded Receipt" className="w-full max-w-[240px] object-contain" />
          </div>
        )}
        <div className="whitespace-pre-wrap font-medium">{msg.text}</div>

        {/* Receipt card for transactions */}
        {msg.card && (
          <div className="mt-4 bg-ivory rounded-[14px] p-4 border border-midnight/5">
            <div className="flex items-center gap-3 mb-3.5">
              <div className="w-10 h-10 rounded-full bg-midnight text-white flex items-center justify-center shadow-inner">
                <CategoryIcon category={msg.card.category} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-extrabold text-muted uppercase tracking-widest">
                  {msg.card.wallet}
                </p>
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-[12.5px] font-bold text-midnight uppercase tracking-wider">
                    {msg.card.category}
                  </span>
                  <span
                    className={`text-[12px] font-bold ${
                      msg.card.type === 'income' ? 'text-gold' : 'text-midnight'
                    }`}
                  >
                    {msg.card.type === 'income' ? '+' : '-'}{formatRupiah(msg.card.amount)}
                  </span>
                </div>
              </div>
            </div>
            <div className="w-full bg-cream h-1.5 rounded-full overflow-hidden">
              <div className="bg-midnight h-full w-full rounded-full opacity-90" />
            </div>
          </div>
        )}
      </div>
      <span className="text-[9.5px] font-bold text-muted/50 uppercase tracking-[0.1em] mt-2.5 mx-1.5 font-jakarta">
        {msg.sender === 'bot' ? 'Financial Analyst' : 'You'} • {msg.time}
      </span>
    </div>
  )
}
