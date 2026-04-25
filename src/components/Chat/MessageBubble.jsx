import { CategoryIcon } from '../shared/CategoryIcon'
import KurogiLogo from '../shared/KurogiLogo'

export default function MessageBubble({ msg, formatRupiah }) {
  const isUser = msg.sender === 'user'
  const displayText = isUser ? msg.text : stripSimpleFormatting(msg.text)

  return (
    <div className={`mb-6 flex w-full animate-fade-in ${isUser ? 'justify-end' : 'justify-start gap-3 sm:gap-4'}`}>
      {!isUser ? <KurogiLogo size={58} className="mt-1 hidden sm:inline-flex" /> : null}
      <div className={`flex max-w-[88%] flex-col ${isUser ? 'items-end' : 'items-start'} md:max-w-[72%]`}>
        <div
          className={`relative text-[16px] leading-relaxed transition-all ${
            isUser
              ? 'rounded-[22px] border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-midnight shadow-sm'
              : 'rounded-[22px] border border-midnight/10 bg-white px-5 py-4 text-midnight shadow-[0_10px_30px_rgba(15,23,42,0.05)]'
          }`}
        >
          {msg.image && (
            <div className="mb-3 overflow-hidden rounded-[16px] border border-midnight/10 bg-white shadow-sm">
              <img src={msg.image} alt="Lampiran" className="w-full max-w-[240px] object-cover" />
            </div>
          )}
          <div className="whitespace-pre-wrap font-medium leading-[1.62]">{displayText}</div>

          {msg.card && (
            <div className="mt-4 rounded-[16px] border border-emerald-100 bg-emerald-50/50 p-4 text-midnight">
              <div className="mb-4 flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <CategoryIcon category={msg.card.category} />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-bold text-muted">
                    {msg.card.wallet}
                  </p>
                  <div className="mt-0.5 flex items-center justify-between gap-3">
                    <span className="text-[14px] font-extrabold capitalize text-midnight">
                      {msg.card.category}
                    </span>
                    <span
                      className={`text-[14px] font-extrabold ${
                        msg.card.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {msg.card.type === 'income' ? '+' : '-'}{formatRupiah(msg.card.amount)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white">
                <div className="h-full w-full rounded-full bg-emerald-500" />
              </div>
            </div>
          )}
        </div>
        <span className="mx-3 mt-2 font-jakarta text-[12px] font-medium text-muted">
          {msg.time}
          {isUser ? '  ✓✓' : ''}
        </span>
      </div>
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
