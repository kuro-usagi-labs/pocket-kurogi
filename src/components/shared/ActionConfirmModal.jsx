import { AlertTriangle, LoaderCircle, X } from 'lucide-react'

const TONE_STYLES = {
  danger: {
    badge: 'bg-red-50 text-red-600 border border-red-100',
    button: 'bg-red-600 text-white hover:bg-red-500 shadow-red-500/20',
  },
  primary: {
    badge: 'bg-midnight/5 text-midnight border border-midnight/8',
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

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 sm:p-0">
      <div
        className="absolute inset-0 bg-midnight/35 backdrop-blur-md transition-opacity"
        onClick={submitting ? undefined : onCancel}
      />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[32px] bg-white shadow-2xl animate-scale-in">
        <div className="p-8">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`mt-0.5 flex h-12 w-12 items-center justify-center rounded-2xl ${styles.badge}`}>
                <AlertTriangle size={22} strokeWidth={2.2} />
              </div>
              <div>
                <h3 className="text-[22px] font-jakarta font-bold tracking-tight text-midnight">
                  {title}
                </h3>
                <p className="mt-1 text-[13px] font-medium text-midnight/45">
                  Pastikan aksi ini memang yang Anda inginkan.
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              disabled={submitting}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-ivory text-midnight/35 transition-colors hover:text-midnight disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          <div className="space-y-3 rounded-[24px] bg-ivory/75 px-5 py-5">
            {paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-[14px] font-medium leading-relaxed text-midnight/75">
                {paragraph}
              </p>
            ))}
          </div>

          <div className="mt-7 flex gap-3">
            <button
              onClick={onCancel}
              disabled={submitting}
              className="flex-1 rounded-2xl border border-midnight/10 bg-white px-5 py-4 text-[12px] font-extrabold uppercase tracking-[0.18em] text-midnight/70 transition-all hover:bg-ivory disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={submitting}
              className={`flex-1 rounded-2xl px-5 py-4 text-[12px] font-extrabold uppercase tracking-[0.18em] transition-all disabled:cursor-not-allowed disabled:opacity-60 ${styles.button}`}
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
