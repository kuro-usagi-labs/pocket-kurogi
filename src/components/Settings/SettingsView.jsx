import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Brain, CalendarDays, Check, LoaderCircle, LogOut, MessageCircle, Moon, Pencil, RotateCcw, ShieldCheck, Smartphone, SunMedium, Tags, Trash2, WalletCards, X } from 'lucide-react'
import { motion as Motion, useReducedMotion } from 'motion/react'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useAccountReset } from '../../hooks/useAccountReset'
import OverlayPortal from '../shared/OverlayPortal'

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
      className="relative h-11 w-[60px] shrink-0 rounded-full disabled:cursor-not-allowed"
    >
      <span
        aria-hidden="true"
        className={`absolute left-1 top-1.5 h-8 w-[52px] rounded-full border p-1 transition-colors ${
          checked ? 'border-orange-700 bg-orange-700' : 'border-midnight/10 bg-midnight/10'
        } ${disabled ? 'opacity-45' : 'shadow-inner'}`}
      >
        <Motion.span
          animate={{ x: checked ? 20 : 0 }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 }}
          className="block h-6 w-6 rounded-full bg-[#fff] shadow-[0_2px_7px_rgba(0,0,0,0.28)]"
        />
      </span>
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
    <section className="surface-card overflow-hidden">
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

const MEMORY_LABELS = Object.freeze({
  preferred_wallet: 'Dompet utama',
  preferred_communication_style: 'Gaya jawaban',
  salary_date: 'Tanggal gajian',
  common_merchant_category: 'Kategori langganan',
  financial_priority: 'Prioritas keuangan',
  saving_goal_preference: 'Target pilihan',
  frequent_transaction_description: 'Transaksi yang sering disebut',
})

function MemorySettings({
  memories = [],
  categoryRules = [],
  walletRules = [],
  wallets = [],
  categories = [],
  onUpdateMemory,
  onDeleteMemory,
  onDeleteLearningRule,
  onClearAllMemory,
}) {
  const [editingId, setEditingId] = useState(null)
  const [draftValue, setDraftValue] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [clearArmed, setClearArmed] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const entries = useMemo(() => [
    ...memories.map((memory) => ({
      id: `memory:${memory.key}`,
      type: 'memory',
      key: memory.key,
      label: MEMORY_LABELS[memory.key] || 'Preferensi',
      value: memory.value,
      displayValue: formatMemoryValue(memory, { wallets, categories }),
      source: memory.source,
    })),
    ...walletRules.map((rule) => ({
      id: `wallet-rule:${rule.keyword}`,
      type: 'wallet-rule',
      keyword: rule.keyword,
      label: `“${rule.keyword}” memakai dompet`,
      displayValue: wallets.find((wallet) => wallet.id === rule.wallet_id)?.name || 'Dompet tidak tersedia',
    })),
    ...categoryRules.map((rule) => ({
      id: `category-rule:${rule.keyword}`,
      type: 'category-rule',
      keyword: rule.keyword,
      label: `“${rule.keyword}” masuk kategori`,
      displayValue: categories.find((category) => category.id === rule.category_id)?.name || 'Kategori tidak tersedia',
    })),
  ], [categories, categoryRules, memories, walletRules, wallets])

  const beginEdit = (entry) => {
    setEditingId(entry.id)
    setDraftValue(String(entry.value ?? ''))
    setFeedback(null)
  }

  const submitEdit = async (entry) => {
    const value = entry.key === 'salary_date' ? Number(draftValue) : draftValue
    if (String(draftValue).trim() === '') return
    setBusyId(entry.id)
    const result = await onUpdateMemory?.({ key: entry.key, value })
    setBusyId(null)
    if (result?.error) {
      setFeedback({ tone: 'error', text: result.error.message || 'Ingatan belum berhasil diubah.' })
      return
    }
    setEditingId(null)
    setFeedback({ tone: 'success', text: 'Ingatan berhasil diperbarui.' })
  }

  const removeEntry = async (entry) => {
    setBusyId(entry.id)
    const result = entry.type === 'memory'
      ? await onDeleteMemory?.(entry.key)
      : await onDeleteLearningRule?.({
          keyword: entry.keyword,
          ruleType: entry.type === 'wallet-rule' ? 'wallet' : 'category',
        })
    setBusyId(null)
    if (result?.error) {
      setFeedback({ tone: 'error', text: result.error.message || 'Ingatan belum berhasil dihapus.' })
      return
    }
    setFeedback({ tone: 'success', text: 'Ingatan sudah dihapus.' })
  }

  const clearAll = async () => {
    if (!clearArmed) {
      setClearArmed(true)
      setFeedback({ tone: 'warning', text: 'Tekan sekali lagi untuk menghapus seluruh ingatan Kurogi.' })
      return
    }
    setBusyId('clear-all')
    const result = await onClearAllMemory?.()
    setBusyId(null)
    setClearArmed(false)
    setFeedback(result?.error
      ? { tone: 'error', text: result.error.message || 'Ingatan belum berhasil dibersihkan.' }
      : { tone: 'success', text: 'Seluruh ingatan Kurogi sudah dibersihkan.' })
  }

  return (
    <section className="surface-card overflow-hidden lg:col-span-2">
      <div className="flex flex-col gap-4 border-b border-midnight/[0.07] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-orange-50 text-orange-700">
            <Brain size={21} strokeWidth={2.2} />
          </div>
          <div>
            <p className="font-jakarta text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">Asisten pribadi</p>
            <h2 className="mt-1 font-jakarta text-[21px] font-extrabold tracking-[-0.035em] text-midnight">Yang Kurogi Ingat</h2>
            <p className="mt-1 max-w-xl text-[13px] font-medium leading-relaxed text-muted">
              Hanya preferensi yang kamu ajarkan atau konfirmasi. Ingatan ini tidak dibagikan ke akun lain.
            </p>
          </div>
        </div>
        {entries.length > 0 ? (
          <button
            type="button"
            disabled={busyId === 'clear-all'}
            onClick={clearAll}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] px-4 py-2.5 font-jakarta text-[12px] font-bold transition-colors disabled:opacity-50 ${clearArmed ? 'bg-red-600 text-white' : 'border border-red-200 text-red-600 hover:bg-red-50'}`}
          >
            {busyId === 'clear-all' ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {clearArmed ? 'Yakin, hapus semua' : 'Hapus semua ingatan'}
          </button>
        ) : null}
      </div>

      <div className="p-4 sm:p-5">
        {feedback ? (
          <p className={`mb-3 rounded-xl px-3 py-2.5 text-[12px] font-bold ${feedback.tone === 'error' ? 'bg-red-50 text-red-700' : feedback.tone === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>
            {feedback.text}
          </p>
        ) : null}

        {entries.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-midnight/15 px-5 py-8 text-center">
            <Brain size={25} className="mx-auto text-muted/60" />
            <p className="mt-3 font-jakarta text-[14px] font-bold text-midnight">Belum ada ingatan tersimpan</p>
            <p className="mt-1 text-[12px] font-medium text-muted">Contoh: “Mulai sekarang BCA dompet utamaku.”</p>
          </div>
        ) : (
          <div className="grid gap-2.5 md:grid-cols-2">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-[16px] border border-midnight/[0.08] bg-champagne/35 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-orange-700 shadow-sm">
                    {memoryIcon(entry)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-muted">{entry.label}</p>
                    <p className="mt-0.5 break-words font-jakarta text-[14px] font-bold text-midnight">{entry.displayValue}</p>
                    {entry.source ? <p className="mt-1 text-[10px] font-semibold text-muted/80">Sumber: {formatMemorySource(entry.source)}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {entry.type === 'memory' ? (
                      <button type="button" aria-label={`Ubah ${entry.label}`} onClick={() => beginEdit(entry)} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-white hover:text-midnight">
                        <Pencil size={15} />
                      </button>
                    ) : null}
                    <button type="button" aria-label={`Hapus ${entry.label}`} disabled={busyId === entry.id} onClick={() => removeEntry(entry)} className="flex h-9 w-9 items-center justify-center rounded-xl text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50">
                      {busyId === entry.id ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>

                {editingId === entry.id ? (
                  <div className="mt-3 flex flex-col gap-2 border-t border-midnight/[0.07] pt-3 sm:flex-row">
                    {renderMemoryEditor(entry, draftValue, setDraftValue, { wallets, categories })}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditingId(null)} className="min-h-10 flex-1 rounded-xl border border-midnight/10 px-3 text-[11px] font-bold text-muted">Batal</button>
                      <button type="button" disabled={busyId === entry.id || !String(draftValue).trim()} onClick={() => submitEdit(entry)} className="min-h-10 flex-1 rounded-xl bg-midnight px-3 text-[11px] font-bold text-white disabled:opacity-40">Simpan</button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function renderMemoryEditor(entry, value, onChange, { wallets, categories }) {
  const commonClass = 'min-h-10 min-w-0 flex-1 rounded-xl border border-midnight/10 bg-white px-3 text-[12px] font-semibold text-midnight'
  if (entry.key === 'preferred_wallet') {
    return <select aria-label="Pilih dompet utama" value={value} onChange={(event) => onChange(event.target.value)} className={commonClass}>{wallets.filter((wallet) => !wallet.is_archived).map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select>
  }
  if (entry.key === 'common_merchant_category') {
    return <select aria-label="Pilih kategori" value={value} onChange={(event) => onChange(event.target.value)} className={commonClass}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
  }
  if (entry.key === 'preferred_communication_style') {
    return <select aria-label="Pilih gaya jawaban" value={value} onChange={(event) => onChange(event.target.value)} className={commonClass}><option value="concise">Ringkas</option><option value="detailed">Detail</option></select>
  }
  return <input aria-label={`Ubah ${entry.label}`} type={entry.key === 'salary_date' ? 'number' : 'text'} min={entry.key === 'salary_date' ? 1 : undefined} max={entry.key === 'salary_date' ? 31 : undefined} value={value} onChange={(event) => onChange(event.target.value)} className={commonClass} />
}

function formatMemoryValue(memory, { wallets, categories }) {
  if (memory.key === 'preferred_wallet') return wallets.find((wallet) => wallet.id === memory.value)?.name || 'Dompet tidak tersedia'
  if (memory.key === 'common_merchant_category') return categories.find((category) => category.id === memory.value)?.name || 'Kategori tidak tersedia'
  if (memory.key === 'preferred_communication_style') return memory.value === 'concise' ? 'Ringkas dan langsung' : 'Lebih detail'
  if (memory.key === 'salary_date') return `Tanggal ${memory.value} setiap bulan`
  return String(memory.value || '')
}

function formatMemorySource(source) {
  return source === 'correction' ? 'koreksi darimu' : source === 'repeated' ? 'kebiasaan berulang' : 'instruksi eksplisit'
}

function memoryIcon(entry) {
  if (entry.type === 'wallet-rule' || entry.key === 'preferred_wallet') return <WalletCards size={17} />
  if (entry.type === 'category-rule' || entry.key === 'common_merchant_category') return <Tags size={17} />
  if (entry.key === 'salary_date') return <CalendarDays size={17} />
  return <MessageCircle size={17} />
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
    <OverlayPortal>
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
    </OverlayPortal>
  )
}

export default function SettingsView({
  memories = [],
  categoryRules = [],
  walletRules = [],
  wallets = [],
  categories = [],
  onUpdateMemory,
  onDeleteMemory,
  onDeleteLearningRule,
  onClearAllMemory,
}) {
  const { user, signOut } = useAuth()
  const { resetAllData, resetting } = useAccountReset()
  const [showResetDialog, setShowResetDialog] = useState(false)

  return (
    <div className="app-scrollbar h-full overflow-y-auto px-4 pb-7 pt-5 sm:px-6 sm:pt-6 lg:px-0 lg:pb-8 lg:pt-0">
      <div className="page-view grid w-full gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="surface-card overflow-hidden">
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

        <MemorySettings
          memories={memories}
          categoryRules={categoryRules}
          walletRules={walletRules}
          wallets={wallets}
          categories={categories}
          onUpdateMemory={onUpdateMemory}
          onDeleteMemory={onDeleteMemory}
          onDeleteLearningRule={onDeleteLearningRule}
          onClearAllMemory={onClearAllMemory}
        />

        <section className="rounded-[20px] border border-red-200/80 bg-white p-5 shadow-[0_20px_60px_-45px_rgba(31,32,38,0.3)] sm:p-6 lg:col-span-2">
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
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[16px] border border-midnight/10 bg-white px-4 py-3.5 font-jakarta text-[12px] font-bold text-muted transition-colors hover:bg-midnight hover:text-white lg:col-span-2 lg:hidden"
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
