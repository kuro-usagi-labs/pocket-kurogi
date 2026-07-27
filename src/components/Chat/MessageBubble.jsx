import { createElement } from 'react'
import { History, Pencil, Undo2 } from 'lucide-react'
import { CategoryIcon } from '../shared/CategoryIcon'
import KurogiLogo from '../shared/KurogiLogo'

export default function MessageBubble({
  msg,
  formatRupiah,
  onReply,
  onCardAction,
  disabled = false,
  isFirstInGroup = true,
  isLastInGroup = true,
}) {
  const isUser = msg.sender === 'user'
  const displayText = isUser ? msg.text : stripSimpleFormatting(msg.text)
  const groupSpacing = isLastInGroup ? 'mb-5' : 'mb-1.5'
  const bubbleShape = getBubbleShape({ isUser, isFirstInGroup, isLastInGroup })

  return (
    <div className={`${groupSpacing} flex w-full ${isUser ? 'justify-end' : 'justify-start gap-2.5 sm:gap-3'}`}>
      {!isUser ? (
        isLastInGroup ? (
          <KurogiLogo size={38} className="mt-auto hidden sm:inline-flex" />
        ) : (
          <span className="hidden h-[38px] w-[38px] shrink-0 sm:block" aria-hidden="true" />
        )
      ) : null}
      <div className={`flex max-w-[88%] flex-col ${isUser ? 'items-end' : 'items-start'} md:max-w-[74%]`}>
        <div
          className={`relative text-[14px] leading-relaxed transition-all sm:text-[15px] ${bubbleShape} ${
            isUser
              ? 'bg-midnight px-4 py-3 text-white shadow-[0_12px_28px_rgba(31,32,38,0.14)]'
              : 'border border-midnight/[0.08] bg-white px-4 py-3.5 text-midnight'
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
                <button
                  key={candidate.id || candidate.name}
                  type="button"
                  disabled={disabled}
                  onClick={() => onReply?.(candidate.name)}
                  className="rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 font-jakarta text-[12px] font-extrabold text-orange-700 transition hover:border-orange-200 hover:bg-orange-100 disabled:opacity-50"
                >
                  {candidate.name}
                </button>
              ))}
            </div>
          ) : null}

          {!isUser && msg.metadata?.intentStatus === 'needs_confirmation' ? (
            <div className="mt-3 rounded-[12px] border border-amber-100 bg-amber-50 px-3.5 py-2.5">
              <p className="font-jakarta text-[12px] font-bold leading-relaxed text-amber-800">
                Balas dengan nama pilihan, "Ya", atau "Batal".
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {['Ya', 'Batal'].map((label) => (
                  <button
                    key={label}
                    type="button"
                    disabled={disabled}
                    onClick={() => onReply?.(label)}
                    className={`rounded-full px-3 py-1.5 font-jakarta text-[11px] font-extrabold transition disabled:opacity-50 ${
                      label === 'Ya'
                        ? 'bg-midnight text-white hover:bg-midnight/90'
                        : 'border border-amber-200 bg-white text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {msg.card ? (
            <TransactionReceiptCard
              card={msg.card}
              disabled={disabled}
              formatRupiah={formatRupiah}
              onAction={onCardAction}
            />
          ) : null}
        </div>
        {isLastInGroup ? (
          <span className="mx-3 mt-1.5 font-jakarta text-[11px] font-medium text-muted">
            {msg.time}
            {isUser ? '  Terkirim' : ''}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function TransactionReceiptCard({ card, disabled = false, formatRupiah, onAction }) {
  const isIncome = card.type === 'income'
  const canUseTransactionAction = Boolean(card.transactionId)

  return (
    <div className="mt-3 overflow-hidden rounded-[16px] border border-orange-200 bg-orange-50 text-midnight">
      <div className="p-3.5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-midnight text-white">
            <CategoryIcon category={card.category} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-bold  text-muted">
              {card.wallet}
            </p>
            <div className="mt-0.5 flex items-center justify-between gap-3">
              <span className="truncate text-[13px] font-extrabold capitalize text-midnight">
                {card.category}
              </span>
              <span
                className={`shrink-0 text-[13px] font-extrabold ${
                  isIncome ? 'text-orange-600' : 'text-rose-600'
                }`}
              >
                {isIncome ? '+' : '-'}{formatRupiah(card.amount)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 border-t border-orange-100 bg-white/72">
        <ReceiptActionButton
          icon={Pencil}
          label="Koreksi"
          disabled={disabled || !canUseTransactionAction || card.canEdit === false}
          onClick={() => onAction?.('edit', card)}
        />
        <ReceiptActionButton
          icon={Undo2}
          label="Undo"
          danger
          disabled={disabled || !canUseTransactionAction || card.canDelete === false}
          onClick={() => onAction?.('undo', card)}
        />
        <ReceiptActionButton
          icon={History}
          label="Histori"
          disabled={disabled}
          onClick={() => onAction?.('history', card)}
        />
      </div>
    </div>
  )
}

function ReceiptActionButton({ icon, label, disabled = false, danger = false, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 border-r border-orange-100 px-2 font-jakarta text-[11px] font-extrabold transition last:border-r-0 disabled:cursor-not-allowed disabled:opacity-45 ${
        danger
          ? 'text-rose-600 hover:bg-rose-50'
          : 'text-midnight hover:bg-orange-50'
      }`}
    >
      {createElement(icon, { size: 14, strokeWidth: 2.3 })}
      {label}
    </button>
  )
}

function getBubbleShape({ isUser, isFirstInGroup, isLastInGroup }) {
  if (isUser) {
    if (isFirstInGroup && isLastInGroup) {
      return 'rounded-[20px] rounded-br-[7px]'
    }

    if (isFirstInGroup) {
      return 'rounded-[20px] rounded-br-[12px]'
    }

    if (isLastInGroup) {
      return 'rounded-[20px] rounded-tr-[12px] rounded-br-[7px]'
    }

    return 'rounded-[20px] rounded-r-[12px]'
  }

  if (isFirstInGroup && isLastInGroup) {
    return 'rounded-[20px] rounded-bl-[7px]'
  }

  if (isFirstInGroup) {
    return 'rounded-[20px] rounded-bl-[12px]'
  }

  if (isLastInGroup) {
    return 'rounded-[20px] rounded-tl-[12px] rounded-bl-[7px]'
  }

  return 'rounded-[20px] rounded-l-[12px]'
}

function stripSimpleFormatting(text = '') {
  return String(text)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*/g, '')
}
