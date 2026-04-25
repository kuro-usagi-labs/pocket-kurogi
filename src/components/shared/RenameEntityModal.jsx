import { useMemo, useState } from 'react'
import { LoaderCircle, PencilLine, X } from 'lucide-react'

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
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-midnight/30 backdrop-blur-md transition-opacity"
        onClick={submitting ? undefined : onClose}
      />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl animate-scale-in">
        <div className="p-5 md:p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-lg bg-midnight/5 text-midnight/75">
                <PencilLine size={22} strokeWidth={2.2} />
              </div>
              <div>
                <h3 className="font-jakarta text-[21px] font-extrabold tracking-tight text-midnight">
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
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-champagne text-muted transition-colors hover:text-midnight disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="ml-1 font-jakarta text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                {label}
              </label>
              <input
                autoFocus
                required
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="w-full rounded-lg border border-midnight/10 bg-champagne px-5 py-4 text-[15px] font-semibold text-midnight outline-none transition-all placeholder:text-muted/50 focus:border-gold/50 focus:bg-white focus:ring-2 focus:ring-gold/20"
              />
            </div>

            {errorMessage ? (
              <div className="rounded-lg border border-red-100 bg-red-50/90 px-4 py-3 text-[12px] font-semibold text-red-600">
                {errorMessage}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg border border-midnight/10 bg-white px-5 py-4 font-jakarta text-[12px] font-extrabold uppercase tracking-[0.12em] text-muted transition-all hover:bg-champagne hover:text-midnight disabled:cursor-not-allowed disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting || !value.trim() || value.trim() === normalizedInitialValue}
                className="rounded-lg bg-midnight px-5 py-4 font-jakarta text-[12px] font-extrabold uppercase tracking-[0.12em] text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
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
  )
}
