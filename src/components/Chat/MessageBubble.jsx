import { CategoryIcon } from '../shared/CategoryIcon'

export default function MessageBubble({ msg, formatRupiah }) {
  const isUser = msg.sender === 'user'
  const displayText = isUser ? msg.text : stripSimpleFormatting(msg.text)

  return (
    <div className={`mb-5 flex w-full animate-fade-in flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`relative max-w-[88%] text-[14.5px] leading-relaxed transition-all md:max-w-[78%] ${
          isUser
            ? 'rounded-2xl rounded-br-md border border-midnight bg-midnight px-4 py-3.5 text-white shadow-[0_10px_24px_rgba(17,24,39,0.14)] md:px-5'
            : 'rounded-2xl rounded-bl-md border border-midnight/8 bg-white px-4 py-3.5 text-midnight shadow-sm md:px-5'
        }`}
      >
        {msg.image && (
          <div className="mb-3 overflow-hidden rounded-lg border border-midnight/10 bg-white shadow-sm">
            <img src={msg.image} alt="Lampiran" className="w-full max-w-[240px] object-cover" />
          </div>
        )}
        <div className="whitespace-pre-wrap font-medium leading-[1.65] tracking-tight">{displayText}</div>

        {msg.card && (
          <div className="mt-4 rounded-lg border border-midnight/10 bg-white p-4 text-midnight shadow-sm">
            <div className="mb-4 flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-midnight text-white">
                <CategoryIcon category={msg.card.category} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                  {msg.card.wallet}
                </p>
                <div className="mt-0.5 flex items-center justify-between gap-3">
                  <span className="text-[13px] font-bold uppercase tracking-wide text-midnight">
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
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream">
              <div className="h-full w-full rounded-full bg-gold" />
            </div>
          </div>
        )}
      </div>
      <span className="mx-1.5 mt-2 font-jakarta text-[10px] font-bold uppercase tracking-[0.1em] text-muted/60">
        {msg.sender === 'bot' ? 'Kurogi' : 'Anda'} - {msg.time}
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
