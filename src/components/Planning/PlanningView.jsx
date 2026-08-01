import { createElement, useEffect, useMemo, useState } from 'react'
import {
  BellRing,
  CalendarDays,
  Check,
  CircleDollarSign,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Target,
  Trash2,
  WalletCards,
} from 'lucide-react'
import {
  buildPlanningCalendar,
  calculateIncomeAllocation,
  finalizePlanningSummary,
  formatPlanningDate,
  simulateSavingsPlan,
  summarizePlanningCalendar,
} from '../../lib/financialPlanning'

const TYPE_COPY = Object.freeze({
  bill: { label: 'Tagihan', color: 'bg-red-50 text-red-600', sign: '−' },
  income: { label: 'Uang masuk', color: 'bg-emerald-50 text-emerald-700', sign: '+' },
  goal_contribution: { label: 'Setoran target', color: 'bg-orange-50 text-orange-700', sign: '−' },
})

const ALLOCATION_FIELDS = Object.freeze([
  ['needsPercent', 'Kebutuhan', 'Makan, tempat tinggal, transport, dan tagihan wajib.'],
  ['savingsPercent', 'Tabungan', 'Target, dana darurat, dan investasi.'],
  ['debtPercent', 'Utang', 'Cicilan dan pelunasan kewajiban.'],
  ['freePercent', 'Uang bebas', 'Hiburan dan belanja fleksibel.'],
])

export default function PlanningView({
  schedules = [],
  reminderPreferences = {},
  allocationPlan = null,
  budgets = [],
  categories = [],
  goals = [],
  wallets = [],
  loading = false,
  error = null,
  formatRupiah,
  onSaveSchedule,
  onDeleteSchedule,
  onSetReminderPreference,
  onSaveAllocationPlan,
  onSetBudget,
  onDeleteBudget,
}) {
  const calendar = useMemo(() => buildPlanningCalendar(schedules, {
    preferences: reminderPreferences,
    from: new Date(),
    days: 60,
  }), [reminderPreferences, schedules])
  const thirtyDayCalendar = useMemo(() => {
    const end = new Date()
    end.setDate(end.getDate() + 30)
    const endKey = toDateInputValue(end)
    return calendar.filter((item) => item.date <= endKey)
  }, [calendar])
  const summary = useMemo(
    () => finalizePlanningSummary(summarizePlanningCalendar(thirtyDayCalendar)),
    [thirtyDayCalendar]
  )

  return (
    <div className="app-scrollbar h-full overflow-y-auto px-4 pb-7 pt-5 sm:px-6 sm:pt-6 lg:px-0 lg:pb-8 lg:pt-0">
      <div className="page-view space-y-4">
        <PlanningHero summary={summary} formatRupiah={formatRupiah} />

        {error ? (
          <div role="alert" className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-bold text-red-700">
            Data rencana belum dapat dimuat. Periksa koneksi lalu buka halaman ini kembali.
          </div>
        ) : null}

        <ReminderControls
          preferences={reminderPreferences}
          onChange={onSetReminderPreference}
        />

        <UpcomingReminders calendar={calendar} formatRupiah={formatRupiah} />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <ScheduleComposer
            goals={goals}
            wallets={wallets}
            categories={categories}
            onSave={onSaveSchedule}
          />
          <PlanningCalendar
            calendar={calendar}
            schedules={schedules}
            loading={loading}
            formatRupiah={formatRupiah}
            onDelete={onDeleteSchedule}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <MonthlyBudgetPlanner
            budgets={budgets}
            categories={categories}
            formatRupiah={formatRupiah}
            onSave={onSetBudget}
            onDelete={onDeleteBudget}
          />
          <IncomeAllocationPlanner
            plan={allocationPlan}
            formatRupiah={formatRupiah}
            onSave={onSaveAllocationPlan}
          />
        </div>

        <SavingsSimulator goals={goals} formatRupiah={formatRupiah} />
      </div>
    </div>
  )
}

function PlanningHero({ summary, formatRupiah }) {
  return (
    <section className="relative overflow-hidden rounded-[22px] bg-midnight p-5 text-white shadow-[0_26px_70px_-36px_rgba(22,24,28,0.62)] sm:p-7">
      <div aria-hidden="true" className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[38px] border-orange-400/10" />
      <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/10 text-orange-300">
            <CalendarDays size={21} />
          </div>
          <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/50">30 hari mendatang</p>
          <h2 className="mt-1.5 max-w-xl font-jakarta text-[26px] font-extrabold tracking-[-0.045em] sm:text-[32px]">Lihat arah uang sebelum tanggalnya tiba.</h2>
          <p className="mt-2 max-w-2xl text-[12px] font-medium leading-relaxed text-white/60 sm:text-[13px]">
            Semua angka di halaman ini adalah rencana. Tidak ada transaksi atau saldo yang berubah otomatis.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
          <HeroMetric label="Akan masuk" value={formatRupiah(summary.income)} tone="text-emerald-300" />
          <HeroMetric label="Akan keluar" value={formatRupiah(summary.outflow)} tone="text-red-300" />
          <HeroMetric label="Selisih rencana" value={formatRupiah(summary.net)} tone={summary.net >= 0 ? 'text-orange-200' : 'text-red-300'} />
          <HeroMetric label="Pengingat aktif" value={`${summary.activeReminders}`} tone="text-white" />
        </div>
      </div>
    </section>
  )
}

function UpcomingReminders({ calendar, formatRupiah }) {
  const today = toDateInputValue(new Date())
  const limit = new Date()
  limit.setDate(limit.getDate() + 7)
  const limitKey = toDateInputValue(limit)
  const reminders = calendar.filter((item) =>
    item.reminderActive && item.date >= today && item.date <= limitKey
  ).slice(0, 4)
  if (reminders.length === 0) return null
  return (
    <section aria-label="Pengingat tujuh hari ke depan" className="rounded-[18px] border border-orange-200 bg-orange-50/80 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-orange-700 text-white"><BellRing size={17} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-extrabold text-midnight">Perlu kamu ingat dalam 7 hari</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {reminders.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-[12px] bg-white/80 px-3 py-2"><span className="min-w-0"><span className="block truncate text-[11px] font-bold text-midnight">{item.title}</span><span className="block text-[9px] font-semibold text-muted">{formatPlanningDate(item.date)}</span></span><span className="money-number shrink-0 text-[11px] font-bold text-orange-700">{formatRupiah(item.amount)}</span></div>)}
          </div>
        </div>
      </div>
    </section>
  )
}

function HeroMetric({ label, value, tone }) {
  return (
    <div className="rounded-[15px] border border-white/10 bg-white/[0.06] p-3 backdrop-blur-sm">
      <p className="text-[9px] font-bold text-white/45">{label}</p>
      <p className={`money-number mt-1 truncate text-[13px] font-bold ${tone}`}>{value}</p>
    </div>
  )
}

function ReminderControls({ preferences, onChange }) {
  const [busy, setBusy] = useState(null)
  const toggle = async (type) => {
    setBusy(type)
    await onChange?.(type, preferences[type] === false)
    setBusy(null)
  }
  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex items-start gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-orange-50 text-orange-700"><BellRing size={20} /></div>
        <div>
          <h2 className="font-jakarta text-[18px] font-extrabold tracking-[-0.03em] text-midnight">Pengingat yang kamu inginkan</h2>
          <p className="mt-1 text-[12px] font-medium text-muted">Matikan per jenis. Jadwal tetap tersimpan dan bisa dilihat di kalender.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {Object.entries(TYPE_COPY).map(([type, copy]) => (
          <button key={type} type="button" disabled={Boolean(busy)} onClick={() => toggle(type)} className="flex min-h-[58px] items-center gap-3 rounded-[15px] border border-midnight/[0.08] bg-champagne/30 px-3.5 text-left transition-colors hover:bg-champagne disabled:opacity-50">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${preferences[type] === false ? 'bg-midnight/8 text-muted' : copy.color}`}>
              {busy === type ? <LoaderCircle size={15} className="animate-spin" /> : preferences[type] === false ? <span className="h-2.5 w-2.5 rounded-full border border-current" /> : <Check size={15} />}
            </span>
            <span><span className="block text-[12px] font-bold text-midnight">{copy.label}</span><span className="mt-0.5 block text-[10px] font-semibold text-muted">{preferences[type] === false ? 'Nonaktif' : 'Aktif'}</span></span>
          </button>
        ))}
      </div>
    </section>
  )
}

function ScheduleComposer({ goals, wallets, categories, onSave }) {
  const [form, setForm] = useState(() => createScheduleDraft())
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event) => {
    event.preventDefault()
    if (!form.title.trim() || Number(form.amount) <= 0 || !form.nextDueDate) return
    if (form.scheduleType === 'goal_contribution' && !form.goalId) return
    setSaving(true)
    setFeedback(null)
    const result = await onSave?.(form)
    setSaving(false)
    if (result?.error) {
      setFeedback({ error: true, text: result.error.message || 'Jadwal belum tersimpan.' })
      return
    }
    setForm(createScheduleDraft())
    setFeedback({ error: false, text: 'Jadwal tersimpan sebagai rencana; belum ada transaksi dibuat.' })
  }

  return (
    <section className="surface-card overflow-hidden">
      <SectionHeader icon={Plus} eyebrow="Jadwal baru" title="Rencanakan uang masuk atau keluar" description="Pilih tanggal pertama dan frekuensinya." />
      <form onSubmit={submit} className="space-y-3 p-5 sm:p-6">
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(TYPE_COPY).map(([value, copy]) => (
            <button key={value} type="button" aria-pressed={form.scheduleType === value} onClick={() => setForm((current) => ({ ...current, scheduleType: value, goalId: value === 'goal_contribution' ? current.goalId : '', categoryId: value === 'bill' ? current.categoryId : '' }))} className={`min-h-11 rounded-[13px] border px-2 py-2 text-[10px] font-bold transition-colors ${form.scheduleType === value ? 'border-orange-700 bg-orange-700 text-white' : 'border-midnight/10 text-muted hover:text-midnight'}`}>{copy.label}</button>
          ))}
        </div>
        <Field label="Nama rencana"><input required maxLength={120} value={form.title} onChange={(event) => set('title', event.target.value)} placeholder={form.scheduleType === 'income' ? 'Gaji bulanan' : form.scheduleType === 'bill' ? 'Tagihan listrik' : 'Setoran target'} className={inputClass} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nominal"><input required type="number" min="1" value={form.amount} onChange={(event) => set('amount', event.target.value)} placeholder="500000" className={inputClass} /></Field>
          <Field label="Frekuensi"><select value={form.cadence} onChange={(event) => set('cadence', event.target.value)} className={inputClass}><option value="once">Sekali</option><option value="weekly">Setiap minggu</option><option value="monthly">Setiap bulan</option></select></Field>
        </div>
        <Field label="Tanggal pertama"><input required type="date" value={form.nextDueDate} onChange={(event) => set('nextDueDate', event.target.value)} className={inputClass} /></Field>
        {form.scheduleType === 'goal_contribution' ? <Field label="Target"><select required value={form.goalId} onChange={(event) => set('goalId', event.target.value)} className={inputClass}><option value="">Pilih target</option>{goals.filter((goal) => goal.status !== 'completed').map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select></Field> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dompet (opsional)"><select value={form.walletId} onChange={(event) => set('walletId', event.target.value)} className={inputClass}><option value="">Belum ditentukan</option>{wallets.filter((wallet) => !wallet.is_archived).map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select></Field>
          {form.scheduleType === 'bill' ? <Field label="Kategori (opsional)"><select value={form.categoryId} onChange={(event) => set('categoryId', event.target.value)} className={inputClass}><option value="">Belum ditentukan</option>{categories.filter((category) => category.type !== 'income').map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field> : <div />}
        </div>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[14px] bg-champagne/45 px-3.5 text-[12px] font-bold text-midnight"><input type="checkbox" checked={form.reminderEnabled} onChange={(event) => set('reminderEnabled', event.target.checked)} className="h-4 w-4 accent-orange-700" /> Ingatkan saat tanggalnya dekat</label>
        {feedback ? <p role="status" className={`rounded-xl px-3 py-2 text-[11px] font-bold ${feedback.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{feedback.text}</p> : null}
        <button type="submit" disabled={saving} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-midnight px-4 text-[12px] font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-50">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />} Simpan rencana</button>
      </form>
    </section>
  )
}

function PlanningCalendar({ calendar, schedules, loading, formatRupiah, onDelete }) {
  const [deleting, setDeleting] = useState(null)
  const firstOccurrences = calendar.slice(0, 12)
  const remove = async (id) => { setDeleting(id); await onDelete?.(id); setDeleting(null) }
  return (
    <section className="surface-card overflow-hidden">
      <SectionHeader icon={CalendarDays} eyebrow="Kalender uang" title="Arus uang yang akan datang" description="Proyeksi 60 hari dari jadwal aktif." />
      <div className="p-4 sm:p-5">
        {loading ? <div className="flex min-h-[240px] items-center justify-center text-muted"><LoaderCircle className="animate-spin" /></div> : firstOccurrences.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[16px] border border-dashed border-midnight/15 px-5 text-center"><CalendarDays size={26} className="text-muted/60" /><p className="mt-3 text-[13px] font-bold text-midnight">Kalender masih kosong</p><p className="mt-1 max-w-xs text-[11px] font-medium text-muted">Buat jadwal pertama. Rencana akan muncul di sini tanpa mengubah saldo.</p></div>
        ) : (
          <div className="space-y-2">
            {firstOccurrences.map((item) => {
              const copy = TYPE_COPY[item.scheduleType]
              const schedule = schedules.find((entry) => entry.id === item.scheduleId)
              return <div key={item.id} className="group flex items-center gap-3 rounded-[15px] border border-midnight/[0.07] bg-champagne/25 p-3 sm:p-3.5"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${copy.color}`}><span className="text-[15px] font-extrabold">{copy.sign}</span></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-[12px] font-bold text-midnight">{item.title}</p>{item.reminderActive ? <BellRing size={12} className="shrink-0 text-orange-600" aria-label="Pengingat aktif" /> : null}</div><p className="mt-0.5 text-[10px] font-semibold text-muted">{formatPlanningDate(item.date)} · {copy.label} · {formatCadence(item.cadence)}</p></div><p className={`money-number shrink-0 text-[12px] font-bold ${item.scheduleType === 'income' ? 'text-emerald-700' : 'text-midnight'}`}>{copy.sign}{formatRupiah(item.amount)}</p>{schedule ? <button type="button" aria-label={`Hapus ${item.title}`} disabled={deleting === schedule.id} onClick={() => remove(schedule.id)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50">{deleting === schedule.id ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}</button> : null}</div>
            })}
          </div>
        )}
        {calendar.length > firstOccurrences.length ? <p className="mt-3 text-center text-[10px] font-bold text-muted">+{calendar.length - firstOccurrences.length} kejadian lain dalam 60 hari</p> : null}
      </div>
    </section>
  )
}

function MonthlyBudgetPlanner({ budgets, categories, formatRupiah, onSave, onDelete }) {
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(null)
  const save = async (event) => { event.preventDefault(); if (!categoryId || Number(amount) <= 0) return; setBusy('save'); await onSave?.(categoryId, Number(amount)); setAmount(''); setBusy(null) }
  const remove = async (id) => { setBusy(id); await onDelete?.(id); setBusy(null) }
  return (
    <section className="surface-card overflow-hidden">
      <SectionHeader icon={ShieldCheck} eyebrow="Batas bulanan" title="Rencana per kategori" description="Batas ini menjadi acuan saran, bukan pembatas transaksi." />
      <div className="p-5 sm:p-6">
        <form onSubmit={save} className="grid gap-2 sm:grid-cols-[1fr_150px_auto]"><select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={inputClass}><option value="">Pilih kategori</option>{categories.filter((category) => category.type !== 'income').map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><input required type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Batas rupiah" className={inputClass} /><button type="submit" disabled={busy === 'save'} className="min-h-11 rounded-[13px] bg-midnight px-4 text-[11px] font-bold text-white disabled:opacity-50">{busy === 'save' ? 'Menyimpan…' : 'Simpan'}</button></form>
        <div className="mt-4 space-y-2">{budgets.length === 0 ? <p className="rounded-[14px] border border-dashed border-midnight/15 px-4 py-6 text-center text-[11px] font-medium text-muted">Belum ada batas kategori.</p> : budgets.map((budget) => <div key={budget.id} className="flex items-center gap-3 rounded-[14px] bg-champagne/35 px-3.5 py-3"><div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white text-orange-700"><WalletCards size={15} /></div><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-bold text-midnight">{budget.categories?.name || 'Kategori'}</p><p className="text-[10px] font-semibold text-muted">per bulan</p></div><p className="money-number text-[12px] font-bold text-midnight">{formatRupiah(budget.monthly_limit)}</p><button type="button" aria-label={`Hapus budget ${budget.categories?.name || ''}`} disabled={busy === budget.id} onClick={() => remove(budget.id)} className="flex h-8 w-8 items-center justify-center rounded-[10px] text-muted hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button></div>)}</div>
      </div>
    </section>
  )
}

function IncomeAllocationPlanner({ plan, formatRupiah, onSave }) {
  const [form, setForm] = useState(() => allocationDraft(plan))
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  useEffect(() => { setForm(allocationDraft(plan)) }, [plan])
  const calculation = calculateIncomeAllocation(form)
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const save = async (event) => { event.preventDefault(); if (!calculation.valid) return; setSaving(true); const result = await onSave?.(form); setSaving(false); setFeedback(result?.error ? 'Alokasi belum tersimpan.' : 'Pembagian gaji tersimpan sebagai rencana.') }
  return (
    <section className="surface-card overflow-hidden">
      <SectionHeader icon={CircleDollarSign} eyebrow="Setelah gajian" title="Bagi uang sebelum terpakai" description="Persentase harus berjumlah tepat 100%." />
      <form onSubmit={save} className="space-y-3 p-5 sm:p-6">
        <Field label="Gaji bersih per bulan"><input required type="number" min="1" value={form.monthlyIncome} onChange={(event) => set('monthlyIncome', event.target.value)} placeholder="5000000" className={inputClass} /></Field>
        <div className="grid gap-2 sm:grid-cols-2">{ALLOCATION_FIELDS.map(([key, label, description]) => <label key={key} className="rounded-[14px] border border-midnight/[0.08] bg-champagne/25 p-3"><span className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold text-midnight">{label}</span><span className="flex items-center gap-1"><input type="number" min="0" max="100" step="1" value={form[key]} onChange={(event) => set(key, event.target.value)} className="h-8 w-16 rounded-[9px] border border-midnight/10 bg-white px-2 text-right text-[11px] font-bold text-midnight" /><span className="text-[10px] font-bold text-muted">%</span></span></span><span className="mt-1 block text-[9px] font-medium leading-relaxed text-muted">{description}</span><span className="money-number mt-2 block text-[11px] font-bold text-orange-700">{formatRupiah(calculation.amounts[key.replace('Percent', '')] || 0)}</span></label>)}</div>
        <div className={`flex items-center justify-between rounded-[13px] px-3.5 py-2.5 text-[11px] font-bold ${calculation.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}><span>Total alokasi</span><span>{calculation.totalPercent}%</span></div>
        {feedback ? <p role="status" className="text-[10px] font-bold text-muted">{feedback}</p> : null}
        <button type="submit" disabled={!calculation.valid || saving} className="min-h-12 w-full rounded-[14px] bg-midnight text-[12px] font-bold text-white disabled:opacity-40">{saving ? 'Menyimpan…' : 'Simpan pembagian gaji'}</button>
      </form>
    </section>
  )
}

function SavingsSimulator({ goals, formatRupiah }) {
  const [goalId, setGoalId] = useState(goals[0]?.id || '')
  const [targetAmount, setTargetAmount] = useState(goals[0]?.target_amount || '')
  const [currentAmount, setCurrentAmount] = useState(goals[0]?.current_amount || 0)
  const [contributionAmount, setContributionAmount] = useState('500000')
  const [cadence, setCadence] = useState('monthly')
  const simulation = simulateSavingsPlan({ targetAmount, currentAmount, contributionAmount, cadence })
  const selectGoal = (id) => { const goal = goals.find((item) => item.id === id); setGoalId(id); if (goal) { setTargetAmount(goal.target_amount); setCurrentAmount(goal.current_amount) } }
  return (
    <section className="surface-card overflow-hidden">
      <SectionHeader icon={Target} eyebrow="Simulasi aman" title="Kapan targetmu akan cukup?" description="Ubah angka sesukamu. Simulasi tidak menambah setoran atau mengubah transaksi." />
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] lg:items-start">
        <div className="grid gap-3 sm:grid-cols-2">{goals.length > 0 ? <Field label="Target tersimpan"><select value={goalId} onChange={(event) => selectGoal(event.target.value)} className={inputClass}><option value="">Angka manual</option>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select></Field> : null}<Field label="Nilai target"><input type="number" min="1" value={targetAmount} onChange={(event) => { setGoalId(''); setTargetAmount(event.target.value) }} className={inputClass} /></Field><Field label="Sudah terkumpul"><input type="number" min="0" value={currentAmount} onChange={(event) => { setGoalId(''); setCurrentAmount(event.target.value) }} className={inputClass} /></Field><Field label="Setoran rutin"><input type="number" min="1" value={contributionAmount} onChange={(event) => setContributionAmount(event.target.value)} className={inputClass} /></Field><Field label="Frekuensi"><select value={cadence} onChange={(event) => setCadence(event.target.value)} className={inputClass}><option value="monthly">Setiap bulan</option><option value="weekly">Setiap minggu</option></select></Field></div>
        <div className="rounded-[18px] bg-midnight p-5 text-white"><p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-white/45">Hasil perkiraan</p>{simulation.valid ? <><p className="mt-3 font-jakarta text-[24px] font-extrabold tracking-[-0.04em] text-orange-200">{formatPlanningDate(simulation.estimatedCompletionAt)}</p><p className="mt-1 text-[11px] font-semibold text-white/55">{simulation.contributionCount} setoran · sisa {formatRupiah(simulation.remaining)}</p><div className="mt-4 rounded-[13px] bg-white/[0.07] p-3 text-[10px] font-medium leading-relaxed text-white/65"><p className="font-bold text-white/85">Rumus yang dipakai</p><p className="mt-1 break-words">{simulation.formula}</p></div><p className="mt-3 flex items-start gap-2 text-[10px] font-medium leading-relaxed text-white/50"><ShieldCheck size={14} className="mt-0.5 shrink-0" /> Ini perkiraan tetap. Bunga, perubahan setoran, dan transaksi masa depan belum dihitung.</p></> : <p className="mt-4 text-[12px] font-medium text-white/60">Isi target dan nominal setoran untuk melihat hasil.</p>}</div>
      </div>
    </section>
  )
}

function SectionHeader({ icon, eyebrow, title, description }) {
  return <div className="flex items-start gap-3.5 border-b border-midnight/[0.07] p-5 sm:p-6"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-orange-50 text-orange-700">{createElement(icon, { size: 20 })}</div><div><p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-muted">{eyebrow}</p><h2 className="mt-1 font-jakarta text-[18px] font-extrabold tracking-[-0.03em] text-midnight">{title}</h2><p className="mt-1 text-[11px] font-medium leading-relaxed text-muted">{description}</p></div></div>
}

function Field({ label, children }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-bold text-muted">{label}</span>{children}</label> }

const inputClass = 'min-h-11 w-full rounded-[13px] border border-midnight/10 bg-white px-3.5 text-[12px] font-semibold text-midnight outline-none transition-colors focus:border-orange-400 focus:ring-2 focus:ring-orange-100'

function createScheduleDraft() { return { title: '', scheduleType: 'bill', amount: '', cadence: 'monthly', nextDueDate: toDateInputValue(new Date()), goalId: '', walletId: '', categoryId: '', reminderEnabled: true, isActive: true } }
function allocationDraft(plan) { return { monthlyIncome: plan?.monthly_income || '', needsPercent: plan?.needs_percent ?? 50, savingsPercent: plan?.savings_percent ?? 20, debtPercent: plan?.debt_percent ?? 10, freePercent: plan?.free_percent ?? 20 } }
function toDateInputValue(value) { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function formatCadence(value) { return value === 'weekly' ? 'mingguan' : value === 'monthly' ? 'bulanan' : 'sekali' }
