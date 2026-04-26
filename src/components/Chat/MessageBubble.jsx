import { CategoryIcon } from '../shared/CategoryIcon'
import KurogiLogo from '../shared/KurogiLogo'

export default function MessageBubble({ msg, formatRupiah }) {
  const isUser = msg.sender === 'user'
  const displayText = isUser ? msg.text : stripSimpleFormatting(msg.text)

  return (
    <div className={`mb-5 flex w-full animate-fade-in ${isUser ? 'justify-end' : 'justify-start gap-2.5 sm:gap-3'}`}>
      {!isUser ? <KurogiLogo size={46} className="mt-1 hidden sm:inline-flex" /> : null}
      <div className={`flex max-w-[88%] flex-col ${isUser ? 'items-end' : 'items-start'} md:max-w-[72%]`}>
        <div
          className={`relative text-[14px] leading-relaxed transition-all sm:text-[15px] ${
            isUser
              ? 'rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-midnight shadow-sm'
              : 'rounded-[20px] border border-midnight/10 bg-white px-4 py-3.5 text-midnight shadow-[0_10px_28px_rgba(15,23,42,0.05)]'
          }`}
        >
          {msg.image && (
            <div className="mb-3 overflow-hidden rounded-[16px] border border-midnight/10 bg-white shadow-sm">
              <img src={msg.image} alt="Lampiran" className="w-full max-w-[240px] object-cover" />
            </div>
          )}
          <div className="whitespace-pre-wrap font-medium leading-[1.58]">{displayText}</div>

          {!isUser && Array.isArray(msg.metadata?.candidates) && msg.metadata.candidates.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {msg.metadata.candidates.slice(0, 5).map((candidate) => (
                <span
                  key={candidate.id || candidate.name}
                  className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 font-jakarta text-[12px] font-extrabold text-emerald-700"
                >
                  {candidate.name}
                </span>
              ))}
            </div>
          ) : null}

          {!isUser && msg.metadata?.intentStatus === 'needs_confirmation' ? (
            <div className="mt-3 rounded-[14px] border border-amber-100 bg-amber-50 px-3.5 py-2.5 font-jakarta text-[12px] font-bold leading-relaxed text-amber-800">
              Balas dengan nama pilihan, "Ya", atau "Batal".
            </div>
          ) : null}

          {msg.card && (
            <div className="mt-3 rounded-[16px] border border-emerald-100 bg-emerald-50/50 p-3.5 text-midnight">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <CategoryIcon category={msg.card.category} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-muted">
                    {msg.card.wallet}
                  </p>
                  <div className="mt-0.5 flex items-center justify-between gap-3">
                    <span className="text-[13px] font-extrabold capitalize text-midnight">
                      {msg.card.category}
                    </span>
                    <span
                      className={`text-[13px] font-extrabold ${
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
        <span className="mx-3 mt-1.5 font-jakarta text-[11px] font-medium text-muted">
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
