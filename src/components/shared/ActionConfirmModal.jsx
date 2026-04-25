import { useEffect, useId } from 'react'
import { AlertTriangle, LoaderCircle, ShieldCheck, Trash2, X } from 'lucide-react'

const TONE_STYLES = {
  danger: {
    eyebrow: 'Aksi permanen',
    Icon: Trash2,
    badge: 'bg-red-50 text-red-600 ring-1 ring-red-100',
    panel: 'border-red-100 bg-red-50/45',
    button: 'bg-red-600 text-white hover:bg-red-500 shadow-red-500/20',
  },
  primary: {
    eyebrow: 'Konfirmasi',
    Icon: ShieldCheck,
    badge: 'bg-midnight/5 text-midnight ring-1 ring-midnight/8',
    panel: 'border-midnight/8 bg-champagne',
    button: 'bg-midnight text-white hover:brightness-110 shadow-midnight/20',
  },
}

export default function ActionConfirmModal({
  title,
  paragraphs = [],
  confirmLabel = 'Lanjutkan',
  cancelLabel = 'Batal',
  tone = 'primary',
  submitting = false,
  onCancel,
  onConfirm,
}) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.primary
  const Icon = styles.Icon || AlertTriangle
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting) {
        onCancel?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel, submitting])

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center p-3 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-midnight/38 backdrop-blur-md transition-opacity"
        onClick={submitting ? undefined : onCancel}
      />

      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        role="dialog"
        className="relative z-10 max-h-[calc(100dvh-24px)] w-full max-w-[430px] overflow-hidden rounded-xl bg-white shadow-2xl animate-scale-in sm:rounded-lg"
      >
        <div className="max-h-[calc(100dvh-24px)] overflow-y-auto p-4 sm:p-5 md:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3.5">
              <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${styles.badge}`}>
                <Icon size={20} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="font-jakarta text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                  {styles.eyebrow}
                </p>
                <h3 id={titleId} className="mt-1 font-jakarta text-[19px] font-extrabold leading-tight tracking-tight text-midnight sm:text-[21px]">
                  {title}
                </h3>
              </div>
            </div>
            <button
              aria-label="Tutup"
              onClick={onCancel}
              disabled={submitting}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-champagne text-muted transition-colors hover:text-midnight disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          <div id={descriptionId} className={`space-y-2.5 rounded-lg border px-4 py-3.5 ${styles.panel}`}>
            {paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-[13.5px] font-medium leading-relaxed text-midnight/75">
                {paragraph}
              </p>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              onClick={onCancel}
              disabled={submitting}
              className="rounded-lg border border-midnight/10 bg-white px-4 py-3.5 font-jakarta text-[11px] font-extrabold uppercase tracking-[0.11em] text-muted transition-all hover:bg-champagne hover:text-midnight disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={submitting}
              className={`rounded-lg px-4 py-3.5 font-jakarta text-[11px] font-extrabold uppercase tracking-[0.11em] transition-all disabled:cursor-not-allowed disabled:opacity-60 ${styles.button}`}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {submitting ? <LoaderCircle size={15} className="animate-spin" strokeWidth={2.2} /> : null}
                {submitting ? 'Memproses...' : confirmLabel}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
