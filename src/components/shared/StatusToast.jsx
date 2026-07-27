import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

const TONE_MAP = {
  success: {
    container: 'border-orange-100 bg-white text-midnight shadow-[0_18px_36px_rgba(15,23,42,0.12)]',
    iconWrap: 'bg-orange-50 text-orange-600',
    bar: 'bg-orange-700',
    label: 'Berhasil',
    Icon: CheckCircle2,
  },
  error: {
    container: 'border-red-100 bg-white text-midnight shadow-[0_18px_36px_rgba(15,23,42,0.12)]',
    iconWrap: 'bg-red-50 text-red-600',
    bar: 'bg-red-500',
    label: 'Perlu Dicek',
    Icon: AlertTriangle,
  },
  info: {
    container: 'border-midnight/10 bg-white text-midnight shadow-[0_18px_36px_rgba(15,23,42,0.12)]',
    iconWrap: 'bg-midnight/5 text-midnight/75',
    bar: 'bg-midnight',
    label: 'Info',
    Icon: Info,
  },
}

export default function StatusToast({
  message,
  tone = 'info',
  onClose,
}) {
  const config = TONE_MAP[tone] || TONE_MAP.info
  const Icon = config.Icon

  return (
    <div
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className="pointer-events-none fixed inset-x-0 top-3 z-[140] flex justify-center px-3 md:top-5 md:justify-end md:px-8"
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <div className={`pointer-events-auto w-full max-w-[360px] overflow-hidden rounded-lg border backdrop-blur-sm animate-fade-in ${config.container}`}>
        <div className={`h-1 w-full ${config.bar}`} />
        <div className="flex items-start gap-3 p-3.5">
          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${config.iconWrap}`}>
            <Icon size={18} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold  text-midnight/45 font-jakarta">
              {config.label}
            </p>
            <p className="mt-1 text-[13px] font-semibold leading-relaxed text-midnight/78">
              {message}
            </p>
          </div>
          <button
            aria-label="Tutup notifikasi"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-champagne text-muted transition-colors hover:text-midnight"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  )
}
