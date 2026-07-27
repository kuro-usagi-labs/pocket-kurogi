import { useMemo, useState } from 'react'
import { LoaderCircle, PencilLine, X } from 'lucide-react'
import OverlayPortal from './OverlayPortal'

export default function RenameEntityModal({
  title,
  subtitle,
  label,
  placeholder,
  initialValue = '',
  submitLabel = 'Simpan',
  onClose,
  onSubmit,
}) {
  const normalizedInitialValue = useMemo(() => String(initialValue || '').trim(), [initialValue])
  const [value, setValue] = useState(normalizedInitialValue)
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    const normalizedValue = value.trim()
    if (!normalizedValue || submitting || normalizedValue === normalizedInitialValue) {
      if (normalizedValue === normalizedInitialValue) {
        onClose()
      }
      return
    }

    setSubmitting(true)
    setErrorMessage('')

    const result = await onSubmit(normalizedValue)

    if (result?.error) {
      setErrorMessage(result.error.message || 'Nama belum bisa diperbarui.')
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
        aria-label={title}
        className="relative z-10 max-h-[calc(100dvh-24px)] w-full max-w-md overflow-y-auto overscroll-contain rounded-[20px] bg-white shadow-2xl animate-scale-in"
      >
        <div className="p-5 md:p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                <PencilLine size={22} strokeWidth={2.2} />
              </div>
              <div>
                <h3 className="font-jakarta text-[23px] font-extrabold tracking-tight text-midnight">
                  {title}
                </h3>
                {subtitle ? (
                  <p className="mt-1 text-[13px] font-medium leading-relaxed text-midnight/45">
                    {subtitle}
                  </p>
                ) : null}
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
            <div className="space-y-2">
              <label className="ml-1 font-jakarta text-[12px] font-extrabold  text-muted">
                {label}
              </label>
              <input
                autoFocus
                required
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="w-full rounded-[16px] border border-midnight/10 bg-champagne px-5 py-4 text-[16px] font-medium text-midnight outline-none transition-all placeholder:text-muted/50 focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
              />
            </div>

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
                disabled={submitting || !value.trim() || value.trim() === normalizedInitialValue}
                className="rounded-[16px] bg-orange-700 px-5 py-4 font-jakarta text-[13px] font-extrabold text-white transition-all hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {submitting ? <LoaderCircle size={15} className="animate-spin" strokeWidth={2.2} /> : null}
                  {submitting ? 'Menyimpan...' : submitLabel}
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
