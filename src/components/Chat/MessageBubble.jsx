import { CategoryIcon } from '../shared/CategoryIcon'

export default function MessageBubble({ msg, formatRupiah }) {
  const isUser = msg.sender === 'user'
  const displayText = isUser ? msg.text : stripSimpleFormatting(msg.text)

  return (
    <div className={`flex flex-col w-full mb-6 animate-fade-in ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`relative max-w-[85%] text-[14.5px] leading-relaxed transition-all duration-500 ease-out hover:translate-y-[-2px] ${
          isUser
            ? 'px-5 py-4 md:px-6 md:py-4 bg-gradient-to-br from-midnight to-slate-800 text-white rounded-[24px] rounded-br-[6px] shadow-[0_8px_20px_rgba(15,23,42,0.15)] hover:shadow-[0_12px_24px_rgba(15,23,42,0.2)] border border-white/5'
            : 'px-5 py-4 md:p-6 bg-white/70 backdrop-blur-2xl text-midnight rounded-[24px] rounded-bl-[6px] border border-white/80 shadow-[0_8px_32px_rgba(15,23,42,0.03)] hover:shadow-[0_12px_40px_rgba(15,23,42,0.06)]'
        }`}
      >
        {msg.image && (
          <div className="mb-3 rounded-2xl overflow-hidden border border-white/20 shadow-md">
            <img src={msg.image} alt="Uploaded Receipt" className="w-full max-w-[240px] object-cover hover:scale-105 transition-transform duration-500" />
          </div>
        )}
        <div className="whitespace-pre-wrap font-medium leading-[1.65] tracking-tight">{displayText}</div>

        {/* Receipt card for transactions */}
        {msg.card && (
          <div className="mt-4 bg-white/60 backdrop-blur-md rounded-[18px] p-4.5 border border-white/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)] transition-transform duration-300 hover:scale-[1.02]">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-midnight to-slate-700 text-white flex items-center justify-center shadow-md">
                <CategoryIcon category={msg.card.category} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-extrabold text-midnight/40 uppercase tracking-[0.15em]">
                  {msg.card.wallet}
                </p>
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-[13px] font-bold text-midnight uppercase tracking-wide">
                    {msg.card.category}
                  </span>
                  <span
                    className={`text-[13px] font-bold ${
                      msg.card.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {msg.card.type === 'income' ? '+' : '-'}{formatRupiah(msg.card.amount)}
                  </span>
                </div>
              </div>
            </div>
            <div className="w-full bg-midnight/5 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-midnight to-slate-600 h-full w-full rounded-full opacity-90" />
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

function stripSimpleFormatting(text = '') {
  return String(text)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*/g, '')
}
