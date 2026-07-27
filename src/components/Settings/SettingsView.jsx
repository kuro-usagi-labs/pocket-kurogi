import { useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, Check, LoaderCircle, LogOut, Moon, RotateCcw, ShieldCheck, Smartphone, SunMedium, X } from 'lucide-react'
import { motion as Motion, useReducedMotion } from 'motion/react'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useAccountReset } from '../../hooks/useAccountReset'

const CONFIRMATION_TEXT = 'RESET'

function SettingsSwitch({ checked, disabled = false, label, onChange }) {
  const reduceMotion = useReducedMotion()

  return (
    <Motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      whileTap={disabled || reduceMotion ? undefined : { scale: 0.96 }}
      className={`relative h-8 w-[52px] shrink-0 rounded-full border p-1 transition-colors disabled:cursor-not-allowed ${
        checked
          ? 'border-orange-700 bg-orange-700'
          : 'border-midnight/10 bg-midnight/10'
      } ${disabled ? 'opacity-45' : 'shadow-inner'}`}
    >
      <Motion.span
        aria-hidden="true"
        animate={{ x: checked ? 20 : 0 }}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 }}
        className="block h-6 w-6 rounded-full bg-[#fff] shadow-[0_2px_7px_rgba(0,0,0,0.28)]"
      />
    </Motion.button>
  )
}

function ThemeSettings() {
  const { preference, resolvedTheme, setThemePreference } = useTheme()
  const reduceMotion = useReducedMotion()
  const followsSystem = preference === 'system'
  const darkModeEnabled = resolvedTheme === 'dark'

  const toggleDarkMode = () => {
    setThemePreference(darkModeEnabled ? 'light' : 'dark')
  }

  const toggleSystemTheme = () => {
    setThemePreference(followsSystem ? resolvedTheme : 'system')
  }

  return (
    <section className="overflow-hidden rounded-[22px] border border-midnight/[0.08] bg-white shadow-[0_20px_60px_-45px_rgba(31,32,38,0.35)]">
      <div className="border-b border-midnight/[0.07] p-5 sm:p-6">
        <p className="font-jakarta text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">Tampilan</p>
        <h2 className="mt-1.5 font-jakarta text-[21px] font-extrabold tracking-[-0.035em] text-midnight">Pilih suasana aplikasi</h2>
        <p className="mt-1 text-[13px] font-medium text-muted">Atur tema yang paling nyaman untuk matamu.</p>
      </div>

      <div className="px-5 sm:px-6">
        <div className="flex items-center gap-3.5 py-5">
          <Motion.div
            initial={false}
            animate={{ rotate: darkModeEnabled ? 0 : 180 }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 28 }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-orange-50 text-orange-700"
          >
            {darkModeEnabled ? <Moon size={20} strokeWidth={2.2} /> : <SunMedium size={20} strokeWidth={2.2} />}
          </Motion.div>
          <div className="min-w-0 flex-1">
            <p className="font-jakarta text-[14px] font-bold text-midnight">Mode gelap</p>
            <p className="mt-0.5 text-[12px] font-medium text-muted">
              {followsSystem ? 'Dikendalikan oleh perangkat' : darkModeEnabled ? 'Aktif' : 'Nonaktif'}
            </p>
          </div>
          <SettingsSwitch
            checked={darkModeEnabled}
            disabled={followsSystem}
            label="Mode gelap"
            onChange={toggleDarkMode}
          />
        </div>

        <div className="h-px bg-midnight/[0.07]" />

        <div className="flex items-center gap-3.5 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-champagne text-muted">
            <Smartphone size={20} strokeWidth={2.1} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-jakarta text-[14px] font-bold text-midnight">Ikuti perangkat</p>
            <p className="mt-0.5 text-[12px] font-medium text-muted">Berubah otomatis bersama sistem.</p>
          </div>
          <SettingsSwitch
            checked={followsSystem}
            label="Ikuti tema perangkat"
            onChange={toggleSystemTheme}
          />
        </div>
      </div>
    </section>
  )
}

function ResetDataDialog({ onClose, onReset, resetting }) {
  const [confirmation, setConfirmation] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const inputRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()
  const canReset = confirmation === CONFIRMATION_TEXT && !resetting

  useEffect(() => {
    inputRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !resetting) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, resetting])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canReset) return

    setErrorMessage('')
    const { error } = await onReset()

    if (error) {
      setErrorMessage(error.message || 'Data belum berhasil direset. Coba lagi.')
      return
    }

    window.location.reload()
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center p-3 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Tutup konfirmasi reset"
        className="absolute inset-0 h-full w-full bg-midnight/45 backdrop-blur-md"
        onClick={resetting ? undefined : onClose}
      />

      <form
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        role="dialog"
        onSubmit={handleSubmit}
        className="relative z-10 max-h-[calc(100dvh-24px)] w-full max-w-[460px] overflow-y-auto rounded-[22px] bg-white p-5 shadow-2xl animate-scale-in sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-red-50 text-red-600 ring-1 ring-red-100">
              <AlertTriangle size={21} strokeWidth={2.2} />
            </div>
            <div>
              <p className="font-jakarta text-[10px] font-extrabold uppercase tracking-[0.12em] text-red-600">
                Tidak dapat dibatalkan
              </p>
              <h2 id={titleId} className="mt-1 font-jakarta text-xl font-extrabold tracking-[-0.03em] text-midnight">
                Reset semua data?
              </h2>
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup"
            disabled={resetting}
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-champagne text-muted transition-colors hover:text-midnight disabled:opacity-50"
          >
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>

        <div id={descriptionId} className="mt-5 rounded-[16px] border border-red-100 bg-red-50/55 p-4 text-[13px] font-medium leading-relaxed text-midnight/75">
          <p>Transaksi, dompet, target, budget, riwayat chat, lampiran, kategori, dan kebiasaan yang dipelajari akan dihapus permanen.</p>
          <p className="mt-2 font-bold text-midnight">Akun dan akses login tetap dipertahankan.</p>
        </div>

        <label htmlFor="reset-confirmation" className="mt-5 block text-[12px] font-bold text-midnight">
          Ketik <span className="rounded-md bg-midnight px-1.5 py-0.5 font-jakarta text-[11px] text-white">RESET</span> untuk melanjutkan
        </label>
        <input
          ref={inputRef}
          id="reset-confirmation"
          value={confirmation}
          disabled={resetting}
          autoComplete="off"
          spellCheck="false"
          onChange={(event) => setConfirmation(event.target.value.toUpperCase())}
          placeholder="Ketik RESET"
          className="mt-2.5 h-12 w-full rounded-[14px] border border-midnight/12 bg-white px-4 font-jakarta text-sm font-bold tracking-[0.12em] text-midnight placeholder:font-inter placeholder:font-medium placeholder:tracking-normal placeholder:text-muted/70 disabled:opacity-60"
        />

        {errorMessage ? (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-[12px] font-bold text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={resetting}
            onClick={onClose}
            className="rounded-[14px] border border-midnight/10 px-4 py-3.5 font-jakarta text-[12px] font-bold text-muted transition-colors hover:bg-champagne hover:text-midnight disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={!canReset}
            className="rounded-[14px] bg-red-600 px-4 py-3.5 font-jakarta text-[12px] font-bold text-white shadow-lg shadow-red-600/15 transition-[background-color,transform,opacity] hover:bg-red-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <span className="inline-flex items-center justify-center gap-2">
              {resetting ? <LoaderCircle size={16} className="animate-spin" /> : <RotateCcw size={16} />}
              {resetting ? 'Mereset...' : 'Reset data'}
            </span>
          </button>
        </div>
      </form>
    </div>
  )
}

export default function SettingsView() {
  const { user, signOut } = useAuth()
  const { resetAllData, resetting } = useAccountReset()
  const [showResetDialog, setShowResetDialog] = useState(false)

  return (
    <div className="h-full overflow-y-auto px-4 pb-28 pt-5 no-scrollbar sm:px-6 sm:pt-6 md:pb-8">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <section className="overflow-hidden rounded-[22px] border border-midnight/[0.08] bg-white shadow-[0_20px_60px_-45px_rgba(31,32,38,0.35)]">
          <div className="border-b border-midnight/[0.07] p-5 sm:p-6">
            <p className="font-jakarta text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">Akun</p>
            <h2 className="mt-1.5 font-jakarta text-[21px] font-extrabold tracking-[-0.035em] text-midnight">Pengaturan pribadi</h2>
            <p className="mt-1 text-[13px] font-medium text-muted">Kelola akses dan data Pocket Kurogi milikmu.</p>
          </div>

          <div className="flex items-center gap-3 p-5 sm:p-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-midnight text-white">
              <ShieldCheck size={20} strokeWidth={2.1} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-muted">Login sebagai</p>
              <p className="truncate font-jakarta text-[14px] font-bold text-midnight">{user?.email || 'Akun Pocket Kurogi'}</p>
            </div>
            <div className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 sm:flex">
              <Check size={12} strokeWidth={2.6} /> Aktif
            </div>
          </div>
        </section>

        <ThemeSettings />

        <section className="rounded-[22px] border border-red-200/80 bg-white p-5 shadow-[0_20px_60px_-45px_rgba(31,32,38,0.3)] sm:p-6">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-red-50 text-red-600">
              <RotateCcw size={20} strokeWidth={2.1} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-jakarta text-[10px] font-extrabold uppercase tracking-[0.12em] text-red-600">Zona reset</p>
              <h3 className="mt-1 font-jakarta text-[17px] font-extrabold tracking-[-0.025em] text-midnight">Mulai lagi dari nol</h3>
              <p className="mt-1.5 max-w-xl text-[13px] font-medium leading-relaxed text-muted">
                Bersihkan seluruh aktivitas keuangan dan percakapan tanpa membuat akun baru. Kamu akan kembali dengan satu dompet Tunai kosong dan kategori bawaan.
              </p>
              <button
                type="button"
                onClick={() => setShowResetDialog(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-[14px] bg-red-600 px-4 py-3 font-jakarta text-[12px] font-bold text-white shadow-lg shadow-red-600/15 transition-[background-color,transform] hover:bg-red-500 active:scale-[0.98]"
              >
                <RotateCcw size={16} strokeWidth={2.3} /> Reset semua data
              </button>
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center justify-center gap-2 rounded-[16px] border border-midnight/10 bg-white px-4 py-3.5 font-jakarta text-[12px] font-bold text-muted transition-colors hover:bg-midnight hover:text-white md:hidden"
        >
          <LogOut size={17} strokeWidth={2.1} /> Keluar dari akun
        </button>
      </div>

      {showResetDialog ? (
        <ResetDataDialog
          resetting={resetting}
          onClose={() => setShowResetDialog(false)}
          onReset={resetAllData}
        />
      ) : null}
    </div>
  )
}
