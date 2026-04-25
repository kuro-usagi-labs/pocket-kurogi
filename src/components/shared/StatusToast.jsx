import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

const TONE_MAP = {
  success: {
    container: 'border-emerald-100 bg-white text-midnight shadow-[0_20px_40px_rgba(15,23,42,0.12)]',
    iconWrap: 'bg-emerald-50 text-emerald-600',
    Icon: CheckCircle2,
  },
  error: {
    container: 'border-red-100 bg-white text-midnight shadow-[0_20px_40px_rgba(15,23,42,0.12)]',
    iconWrap: 'bg-red-50 text-red-600',
    Icon: AlertTriangle,
  },
  info: {
    container: 'border-midnight/10 bg-white text-midnight shadow-[0_20px_40px_rgba(15,23,42,0.12)]',
    iconWrap: 'bg-midnight/5 text-midnight/75',
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
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[140] flex justify-center px-4 md:justify-end md:px-10">
      <div className={`pointer-events-auto w-full max-w-sm rounded-lg border p-4 backdrop-blur-sm animate-fade-in ${config.container}`}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg ${config.iconWrap}`}>
            <Icon size={18} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-midnight/45 font-jakarta">
              {tone === 'success' ? 'Berhasil' : tone === 'error' ? 'Perlu Dicek' : 'Info'}
            </p>
            <p className="mt-1 text-[13px] font-semibold leading-relaxed text-midnight/75">
              {message}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-champagne text-muted transition-colors hover:text-midnight"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  )
}
