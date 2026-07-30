import { createElement } from 'react'
import { BarChart3, Check, History, Pencil, Undo2, X } from 'lucide-react'
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
  const candidates = Array.isArray(msg.metadata?.candidates) ? msg.metadata.candidates : []
  const confirmationMode = msg.metadata?.confirmationMode || (candidates.length > 0 ? 'choice' : 'input')
  const confirmationHint = msg.metadata?.confirmationHint || getConfirmationHint(confirmationMode)
  const hasPendingActionCard = msg.card?.type === 'pending_action'
  const showInlineConfirmation =
    !isUser &&
    msg.metadata?.intentStatus === 'needs_confirmation' &&
    confirmationMode !== 'card' &&
    !hasPendingActionCard

  return (
    <div className={`${groupSpacing} flex w-full ${isUser ? 'justify-end' : 'justify-start gap-2.5 sm:gap-3'}`}>
      {!isUser ? (
        isLastInGroup ? (
          <KurogiLogo size={38} className="mt-auto hidden sm:inline-flex" />
        ) : (
          <span className="hidden h-[38px] w-[38px] shrink-0 sm:block" aria-hidden="true" />
        )
      ) : null}
      <div className={`flex max-w-[91%] flex-col ${isUser ? 'items-end' : 'items-start'} sm:max-w-[84%] md:max-w-[78%]`}>
        <div
          className={`relative text-[14px] leading-relaxed transition-all sm:text-[15px] ${bubbleShape} ${
            isUser
              ? 'bg-midnight px-4 py-3 text-white shadow-[0_12px_28px_rgba(31,32,38,0.14)]'
              : 'border border-midnight/[0.08] bg-white px-4 py-3.5 text-midnight shadow-[0_12px_30px_-28px_rgba(25,27,32,0.5)]'
          }`}
        >
          {msg.image && (
            <div className="mb-3 overflow-hidden rounded-[16px] border border-midnight/10 bg-white shadow-sm">
              <img src={msg.image} alt="Lampiran" className="w-full max-w-[240px] object-cover" />
            </div>
          )}
          <div className="whitespace-pre-wrap font-medium leading-[1.58]">{displayText}</div>

          {!isUser && candidates.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {candidates.slice(0, 5).map((candidate) => (
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

          {showInlineConfirmation ? (
            <div className="mt-3 rounded-[12px] border border-amber-100 bg-amber-50 px-3.5 py-2.5">
              <p className="font-jakarta text-[12px] font-bold leading-relaxed text-amber-800">
                {confirmationHint}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(confirmationMode === 'binary' ? ['Ya', 'Batal'] : ['Batal']).map((label) => (
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
            msg.card.type === 'pending_action' ? (
              <PendingActionCard
                card={msg.card}
                disabled={disabled}
                formatRupiah={formatRupiah}
                onAction={onCardAction}
              />
            ) : msg.card.type === 'financial_insight' ? (
              <FinancialInsightCard card={msg.card} />
            ) : msg.card.batch && Array.isArray(msg.card.items) ? (
              <BatchReceiptCard
                card={msg.card}
                disabled={disabled}
                formatRupiah={formatRupiah}
                onAction={onCardAction}
              />
            ) : (
              <TransactionReceiptCard
                card={msg.card}
                disabled={disabled}
                formatRupiah={formatRupiah}
                onAction={onCardAction}
              />
            )
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

function getConfirmationHint(mode) {
  if (mode === 'binary') return 'Konfirmasi aksi ini atau batalkan.'
  if (mode === 'choice') return 'Pilih salah satu opsi di atas atau batalkan.'
  return 'Lengkapi jawaban yang diminta, atau batalkan.'
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

      <div className="grid grid-cols-3 border-t border-orange-100 bg-[var(--surface-strong)]">
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

function FinancialInsightCard({ card }) {
  const details = Array.isArray(card.details) ? card.details : []

  return (
    <section
      className="mt-3 overflow-hidden rounded-[16px] border border-sky-200 bg-sky-50 text-midnight"
      aria-label="Insight keuangan dari data tersimpan"
    >
      <div className="flex items-center gap-2.5 border-b border-sky-100 px-3.5 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-midnight text-white">
          <BarChart3 size={16} aria-hidden="true" />
        </span>
        <div>
          <p className="text-[10px] font-bold text-sky-700">
            {card.available === false ? 'Data belum cukup' : 'Berdasarkan data Neon'}
          </p>
          <p className="text-[13px] font-extrabold">{card.title || 'Insight keuangan'}</p>
        </div>
      </div>
      {details.length > 0 ? (
        <ul className="surface-translucent divide-y divide-sky-100">
          {details.map((detail, index) => (
            <li key={`${index}-${detail}`} className="px-3.5 py-2.5 text-[11px] font-bold leading-relaxed">
              {detail}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function PendingActionCard({ card, disabled = false, formatRupiah, onAction }) {
  const items = Array.isArray(card.items) ? card.items : []

  return (
    <section
      className="mt-3 overflow-hidden rounded-[16px] border border-amber-200 bg-amber-50 text-midnight"
      aria-label="Aksi keuangan menunggu konfirmasi"
    >
      <div className="border-b border-amber-200/70 px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold text-amber-700">Menunggu konfirmasi</p>
            <p className="mt-0.5 text-[13px] font-extrabold">{card.title}</p>
          </div>
          {Number(card.amount || 0) > 0 ? (
            <p className="shrink-0 text-[13px] font-extrabold text-amber-800">
              {formatRupiah(card.amount)}
            </p>
          ) : null}
        </div>

        {card.sourceWallet ? (
          <p className="mt-2 text-[11px] font-bold text-muted">
            {card.destinationWallet
              ? `${card.sourceWallet} → ${card.destinationWallet}`
              : `Dompet: ${card.sourceWallet}`}
          </p>
        ) : null}
      </div>

      {items.length > 0 ? (
        <div className="surface-translucent divide-y divide-amber-100">
          {items.map((item, index) => (
            <div key={item.id || index} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-extrabold">
                  {item.description || `Transaksi ${index + 1}`}
                </p>
                {item.category ? (
                  <p className="mt-0.5 text-[10px] font-bold text-muted">{item.category}</p>
                ) : null}
              </div>
              <p className="shrink-0 text-[11px] font-extrabold text-midnight">
                {formatRupiah(item.amount)}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {Array.isArray(card.missingFields) && card.missingFields.length > 0 ? (
        <div className="border-t border-amber-100 px-3.5 py-2.5 text-[10px] font-bold text-amber-800">
          Data yang masih kurang: {card.missingFields.join(', ')}
        </div>
      ) : null}

      <div className="grid grid-cols-3 border-t border-amber-200 bg-white">
        <ReceiptActionButton
          icon={Check}
          label="Konfirmasi"
          disabled={disabled}
          onClick={() => onAction?.('assistant-confirm', card)}
        />
        <ReceiptActionButton
          icon={Pencil}
          label="Ubah"
          disabled={disabled}
          onClick={() => onAction?.('assistant-edit', card)}
        />
        <ReceiptActionButton
          icon={X}
          label="Batal"
          danger
          disabled={disabled}
          onClick={() => onAction?.('assistant-cancel', card)}
        />
      </div>
    </section>
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

function BatchReceiptCard({ card, disabled = false, formatRupiah, onAction }) {
  const items = Array.isArray(card.items) ? card.items : []
  const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const incomeTotal = items
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const expenseTotal = total - incomeTotal
  const isIncomeOnly = incomeTotal > 0 && expenseTotal === 0
  const isMixed = incomeTotal > 0 && expenseTotal > 0

  return (
    <div className="mt-3 overflow-hidden rounded-[16px] border border-orange-200 bg-orange-50 text-midnight">
      <div className="flex items-center justify-between gap-3 border-b border-orange-100 px-3.5 py-3">
        <div>
          <p className="text-[10px] font-bold text-muted">Batch transaksi</p>
          <p className="mt-0.5 text-[13px] font-extrabold">{items.length} catatan tersimpan</p>
        </div>
        <p className={`text-right text-[13px] font-extrabold ${isIncomeOnly ? 'text-orange-600' : isMixed ? 'text-midnight' : 'text-rose-600'}`}>
          {isMixed
            ? `+${formatRupiah(incomeTotal)} / -${formatRupiah(expenseTotal)}`
            : `${isIncomeOnly ? '+' : '-'}${formatRupiah(total)}`}
        </p>
      </div>

      <div className="divide-y divide-orange-100">
        {items.map((item, index) => {
          const isIncome = item.type === 'income'
          const canUseAction = Boolean(item.transactionId)

          return (
            <div key={item.transactionId || `${item.category}-${index}`} className="surface-translucent px-3.5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-midnight text-white">
                  <CategoryIcon category={item.category} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-extrabold">{item.desc || item.category}</p>
                  <p className="mt-0.5 truncate text-[10px] font-bold text-muted">
                    {item.wallet} · {item.category}
                  </p>
                </div>
                <p className={`shrink-0 text-[12px] font-extrabold ${isIncome ? 'text-orange-600' : 'text-rose-600'}`}>
                  {isIncome ? '+' : '-'}{formatRupiah(item.amount)}
                </p>
              </div>

              <div className="mt-2.5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={disabled || !canUseAction || item.canEdit === false}
                  onClick={() => onAction?.('edit', item)}
                  className="inline-flex items-center gap-1 rounded-full border border-orange-100 bg-white px-2.5 py-1 text-[10px] font-extrabold text-midnight disabled:opacity-40"
                >
                  <Pencil size={12} strokeWidth={2.3} />
                  Koreksi
                </button>
                <button
                  type="button"
                  disabled={disabled || !canUseAction || item.canDelete === false}
                  onClick={() => onAction?.('undo', item)}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-100 bg-white px-2.5 py-1 text-[10px] font-extrabold text-rose-600 disabled:opacity-40"
                >
                  <Undo2 size={12} strokeWidth={2.3} />
                  Undo
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onAction?.('history', card)}
        className="inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 border-t border-orange-100 bg-[var(--surface-strong)] px-3 font-jakarta text-[11px] font-extrabold text-midnight disabled:opacity-45"
      >
        <History size={14} strokeWidth={2.3} />
        Buka histori
      </button>
    </div>
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
