import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, LoaderCircle, PencilLine, X } from 'lucide-react'
import OverlayPortal from '../shared/OverlayPortal'

function parseAmountInput(value = '') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^rp\s*/, '')
    .replace(/\s+/g, '')

  if (!normalized) {
    return 0
  }

  const suffixMatch = normalized.match(/^(\d+(?:[.,]\d+)?)(k|rb|ribu|jt|juta|m)?$/i)
  if (!suffixMatch) {
    const plainValue = normalized.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.')
    const plainNumber = Number(plainValue)
    return Number.isFinite(plainNumber) ? plainNumber : 0
  }

  let amount = Number(String(suffixMatch[1] || '').replace(',', '.'))
  const multiplier = String(suffixMatch[2] || '').toLowerCase()

  if (['k', 'rb', 'ribu'].includes(multiplier)) amount *= 1000
  else if (['jt', 'juta'].includes(multiplier)) amount *= 1000000
  else if (multiplier === 'm') amount *= 1000000000

  return Number.isFinite(amount) ? amount : 0
}

function formatAmountInput(value = 0) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount <= 0) {
    return ''
  }

  return amount.toLocaleString('id-ID')
}

export default function EditTransactionModal({
  transaction,
  wallets = [],
  categories = [],
  formatRupiah,
  onClose,
  onSubmit,
}) {
  const initialDescription = String(
    transaction?.merchant || transaction?.notes || transaction?.desc || ''
  ).trim()
  const initialType = transaction?.type || 'expense'
  const initialWalletId = transaction?.walletId || wallets[0]?.id || ''
  const initialCategoryId = transaction?.categoryId || ''
  const initialAmount = formatAmountInput(transaction?.amount || 0)

  const [type, setType] = useState(initialType)
  const [walletId, setWalletId] = useState(initialWalletId)
  const [categoryId, setCategoryId] = useState(initialCategoryId)
  const [amountText, setAmountText] = useState(initialAmount)
  const [description, setDescription] = useState(initialDescription)
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const amountPreview = parseAmountInput(amountText)
  const filteredCategories = useMemo(
    () =>
      categories.filter((category) => {
        const categoryType = String(category.category_type || 'expense').toLowerCase()
        return categoryType === 'both' || categoryType === type
      }),
    [categories, type]
  )

  const hasChanges =
    type !== initialType ||
    walletId !== initialWalletId ||
    (categoryId || '') !== (initialCategoryId || '') ||
    amountPreview !== Number(transaction?.amount || 0) ||
    description.trim() !== initialDescription

  const handleTypeChange = (nextType) => {
    setType(nextType)

    const currentCategoryStillValid = categories.some((category) => {
      const categoryType = String(category.category_type || 'expense').toLowerCase()
      return category.id === categoryId && (categoryType === 'both' || categoryType === nextType)
    })

    if (!currentCategoryStillValid) {
      const nextFallbackCategory = categories.find((category) => {
        const categoryType = String(category.category_type || 'expense').toLowerCase()
        return categoryType === 'both' || categoryType === nextType
      })
      setCategoryId(nextFallbackCategory?.id || '')
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const normalizedDescription = description.trim()
    if (submitting) {
      return
    }

    if (!walletId) {
      setErrorMessage('Pilih dompet tujuan transaksi.')
      return
    }

    if (!amountPreview || amountPreview <= 0) {
      setErrorMessage('Nominal transaksi belum valid.')
      return
    }

    if (!normalizedDescription) {
      setErrorMessage('Isi catatan singkat transaksi.')
      return
    }

    setSubmitting(true)
    setErrorMessage('')

    const result = await onSubmit({
      transactionId: transaction.id,
      type,
      walletId,
      categoryId: categoryId || null,
      amount: amountPreview,
      desc: normalizedDescription,
      notes: null,
      occurredAt: transaction.occurredAt,
    })

    if (result?.error) {
      setErrorMessage(result.error.message || 'Transaksi belum bisa diperbarui.')
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onClose()
  }

  return (
    <OverlayPortal>
    <div className="fixed inset-0 z-[130] flex items-end justify-center p-3 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-midnight/30 backdrop-blur-md transition-opacity"
        onClick={submitting ? undefined : onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Koreksi transaksi"
        className="relative z-10 max-h-[calc(100dvh-24px)] w-full max-w-xl overflow-y-auto overscroll-contain rounded-[20px] bg-white shadow-2xl animate-scale-in"
      >
        <div className="p-5 md:p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                <PencilLine size={22} strokeWidth={2.2} />
              </div>
              <div>
                <h3 className="font-jakarta text-[23px] font-extrabold tracking-tight text-midnight">
                  Koreksi transaksi
                </h3>
                <p className="mt-1 text-[13px] font-medium leading-relaxed text-midnight/45">
                  {transaction.date} • {transaction.time}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-champagne text-muted transition-colors hover:text-midnight disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="ml-1 font-jakarta text-[12px] font-extrabold  text-muted">
                  Jenis
                </label>
                <div className="grid grid-cols-2 gap-2 rounded-[16px] border border-midnight/10 bg-champagne p-1.5">
                  <TypeButton
                    active={type === 'expense'}
                    icon={ArrowDownRight}
                    label="Keluar"
                    onClick={() => handleTypeChange('expense')}
                  />
                  <TypeButton
                    active={type === 'income'}
                    icon={ArrowUpRight}
                    label="Masuk"
                    onClick={() => handleTypeChange('income')}
                  />
                </div>
              </div>

              <FieldWrap label="Nominal">
                <input
                  autoFocus
                  type="text"
                  value={amountText}
                  onChange={(event) => setAmountText(event.target.value)}
                  placeholder="Contoh: 25.000"
                  className="w-full rounded-[16px] border border-midnight/10 bg-champagne px-4 py-3 text-[15px] font-semibold text-midnight outline-none transition-all placeholder:text-muted/50 focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
                />
                <p className="mt-2 text-[12px] font-semibold text-muted">
                  {amountPreview > 0 ? formatRupiah(amountPreview) : 'Masukkan nominal'}
                </p>
              </FieldWrap>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FieldWrap label="Dompet">
                <select
                  value={walletId}
                  onChange={(event) => setWalletId(event.target.value)}
                  className="w-full rounded-[16px] border border-midnight/10 bg-champagne px-4 py-3 text-[15px] font-semibold text-midnight outline-none transition-all focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
                >
                  {wallets.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name}
                    </option>
                  ))}
                </select>
              </FieldWrap>

              <FieldWrap label="Kategori">
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="w-full rounded-[16px] border border-midnight/10 bg-champagne px-4 py-3 text-[15px] font-semibold text-midnight outline-none transition-all focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
                >
                  {filteredCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </FieldWrap>
            </div>

            <FieldWrap label="Catatan">
              <input
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Contoh: Kopi sore"
                className="w-full rounded-[16px] border border-midnight/10 bg-champagne px-4 py-3 text-[15px] font-semibold text-midnight outline-none transition-all placeholder:text-muted/50 focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
              />
            </FieldWrap>

            {errorMessage ? (
              <div className="rounded-[16px] border border-red-100 bg-red-50/90 px-4 py-3 text-[13px] font-semibold text-red-600">
                {errorMessage}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-[16px] border border-midnight/10 bg-white px-5 py-4 font-jakarta text-[13px] font-extrabold text-muted transition-all hover:bg-champagne hover:text-midnight disabled:cursor-not-allowed disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting || !hasChanges}
                className="rounded-[16px] bg-orange-700 px-5 py-4 font-jakarta text-[13px] font-extrabold text-white transition-all hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {submitting ? <LoaderCircle size={15} className="animate-spin" strokeWidth={2.2} /> : null}
                  {submitting ? 'Menyimpan...' : 'Simpan koreksi'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    </OverlayPortal>
  )
}

function FieldWrap({ label, children }) {
  return (
    <div className="space-y-2">
      <label className="ml-1 font-jakarta text-[12px] font-extrabold  text-muted">
        {label}
      </label>
      {children}
    </div>
  )
}

function TypeButton({ active, icon, label, onClick }) {
  const IconComponent = icon

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-[12px] font-jakarta text-[13px] font-extrabold transition-all ${
        active ? 'bg-white text-midnight shadow-sm' : 'text-muted hover:text-midnight'
      }`}
    >
      <IconComponent size={16} strokeWidth={2.3} />
      {label}
    </button>
  )
}
