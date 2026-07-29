import { formatRupiah } from './formatters'

const ACKNOWLEDGMENTS = Object.freeze({
  record_expense: ['Aku menangkap pengeluaran berikut.', 'Rincian pengeluarannya sudah terbaca.'],
  record_income: ['Aku menangkap pemasukan berikut.', 'Rincian pemasukannya sudah terbaca.'],
  record_multiple_transactions: ['Aku menangkap beberapa transaksi.', 'Rincian transaksi jamaknya sudah terbaca.'],
  transfer_money: ['Aku menangkap perpindahan antar-dompet.', 'Rincian transfernya sudah terbaca.'],
  create_budget: ['Rencana budgetnya sudah terbaca.'],
  update_budget: ['Perubahan budgetnya sudah terbaca.'],
  create_saving_goal: ['Target tabungannya sudah terbaca.'],
  update_saving_goal: ['Perubahan targetnya sudah terbaca.'],
})

export function composeAssistantResponse({
  intent,
  confidence = 0,
  emotion = { emotion: 'neutral' },
  slots = {},
  clarification = null,
  pendingAction = null,
  insight = null,
  status = 'ready',
  memory = [],
} = {}) {
  const style = resolveCommunicationStyle(memory)
  const components = {
    acknowledgment: selectAcknowledgment(intent, slots),
    empathy: composeEmpathy(emotion, status),
    interpretation: composeInterpretation(intent, slots),
    details: composeDetails(intent, slots),
    insight: insight?.text || null,
    warning: composeWarning({ confidence, status }),
    clarification: clarification?.question || null,
    confirmation: pendingAction
      ? 'Periksa ringkasannya, lalu pilih Konfirmasi, Ubah, atau Batal.'
      : null,
    nextSuggestion: composeNextSuggestion(intent, status),
  }

  return {
    text: joinResponseComponents(components, style),
    components,
    card: pendingAction
      ? buildPendingActionCard(pendingAction, slots, clarification)
      : insight
        ? buildInsightCard(insight)
        : null,
  }
}

export function joinResponseComponents(components, style = 'balanced') {
  const primary = [
    components.empathy,
    components.acknowledgment,
    components.interpretation,
  ].filter(Boolean)
  const details = Array.isArray(components.details) && components.details.length > 0
    ? components.details.map((detail) => `- ${detail}`).join('\n')
    : null
  const secondary = [
    details,
    components.insight,
    components.warning,
    components.clarification,
    components.confirmation,
    style === 'concise' ? null : components.nextSuggestion,
  ].filter(Boolean)

  return [...primary, ...secondary].join('\n\n')
}

function selectAcknowledgment(intent, slots) {
  const variants = ACKNOWLEDGMENTS[intent]
  if (!variants?.length) return null
  const selector = stableSelector(`${intent}:${slots.amount || slots.items?.length || 0}`)
  return variants[selector % variants.length]
}

function composeEmpathy(emotionalContext, status) {
  if (status === 'clarification' && emotionalContext.emotion === 'confused') {
    return 'Tidak apa-apa, kita rapikan satu informasi dulu.'
  }
  return {
    worried: 'Kondisinya memang perlu dijaga dengan hati-hati.',
    stressed: 'Aku paham ini terasa menekan; kita fokus ke angka yang bisa dikendalikan.',
    regretful: 'Yang penting sekarang datanya dirapikan supaya langkah berikutnya lebih jelas.',
    proud: 'Bagus, progresnya layak dipertahankan.',
    motivated: 'Momentum ini bagus untuk dijadikan kebiasaan.',
    urgent: 'Kita prioritaskan kebutuhan paling mendesak terlebih dahulu.',
  }[emotionalContext.emotion] || null
}

function composeInterpretation(intent, slots) {
  if (intent === 'calculate_change' && slots.tenderedAmount && slots.changeAmount) {
    const spent = slots.tenderedAmount - slots.changeAmount
    if (spent >= 0) {
      return `Dari uang ${formatRupiah(slots.tenderedAmount)} dan kembalian ${formatRupiah(slots.changeAmount)}, nilai belanjanya ${formatRupiah(spent)}.`
    }
  }
  if (intent === 'record_expense' || intent === 'record_income') {
    const direction = intent === 'record_income' ? 'pemasukan' : 'pengeluaran'
    const description = slots.description ? ` untuk ${slots.description}` : ''
    const wallet = slots.wallet?.name ? ` melalui ${slots.wallet.name}` : ''
    const amount = slots.amount ? ` ${formatRupiah(slots.amount)}` : ''
    return `Pemahamanku: ${direction}${amount}${description}${wallet}.`
  }
  if (intent === 'transfer_money') {
    return `Pemahamanku: pindahkan ${formatRupiah(slots.amount)} dari ${slots.sourceWallet?.name || 'dompet sumber'} ke ${slots.destinationWallet?.name || 'dompet tujuan'}.`
  }
  if (intent === 'record_multiple_transactions') {
    const total = (slots.items || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
    return `Total ${slots.items?.length || 0} transaksi adalah ${formatRupiah(total)}.`
  }
  return null
}

function composeDetails(intent, slots) {
  if (intent !== 'record_multiple_transactions') return []
  return (slots.items || []).map((item) =>
    `${item.description || 'Transaksi'} ${formatRupiah(item.amount)}`
  )
}

function composeWarning({ confidence, status }) {
  if (status === 'blocked') return 'Belum ada data finansial yang diubah.'
  if (confidence > 0 && confidence < 0.62) {
    return 'Pemahamannya masih berkeyakinan rendah, jadi aku tidak akan menebak.'
  }
  return null
}

function composeNextSuggestion(intent, status) {
  if (status === 'clarification') return 'Jawab hanya informasi yang ditanyakan; detail lain yang sudah ada tetap tersimpan.'
  if (intent === 'calculate_change') return 'Jika ingin dicatat, sebutkan keterangan dan dompetnya.'
  return null
}

function buildPendingActionCard(action, slots, clarification) {
  return {
    type: 'pending_action',
    id: action.id,
    status: action.status,
    title: humanizeAction(action.intent || action.actionType || 'aksi_keuangan'),
    actionType: action.actionType,
    amount: slots.amount || sumItemAmounts(slots.items),
    sourceWallet: slots.sourceWallet?.name || slots.wallet?.name || null,
    destinationWallet: slots.destinationWallet?.name || null,
    items: (slots.items || []).map((item) => ({
      id: item.clientItemId,
      description: item.description,
      amount: item.amount,
      category: item.category || null,
    })),
    missingFields: clarification?.field ? [clarification.field] : [],
    actions: ['confirm', 'edit', 'cancel'],
    expiresAt: action.expiresAt,
  }
}

function buildInsightCard(insight) {
  return {
    type: 'financial_insight',
    title: 'Insight keuangan',
    available: insight.available !== false,
    details: insight.details || [],
  }
}

function humanizeAction(intent) {
  return {
    record_expense: 'Konfirmasi pengeluaran',
    record_income: 'Konfirmasi pemasukan',
    record_multiple_transactions: 'Konfirmasi beberapa transaksi',
    transfer_money: 'Konfirmasi transfer antar-dompet',
    create_budget: 'Konfirmasi budget',
    update_budget: 'Konfirmasi perubahan budget',
    create_saving_goal: 'Konfirmasi target tabungan',
    update_saving_goal: 'Konfirmasi perubahan target',
  }[intent] || `Konfirmasi ${String(intent || 'aksi keuangan').replaceAll('_', ' ')}`
}

function resolveCommunicationStyle(memory) {
  const preference = memory.find((entry) =>
    entry.key === 'preferred_communication_style' && Number(entry.confidence || 0) >= 0.75
  )
  return preference?.value || 'balanced'
}

function sumItemAmounts(items = []) {
  return items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
}

function stableSelector(value) {
  return Array.from(String(value)).reduce((sum, character) => sum + character.codePointAt(0), 0)
}
