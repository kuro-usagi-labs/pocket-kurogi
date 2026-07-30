import { formatRupiah } from './formatters'
import {
  applyResponsePlan,
  planAssistantResponse,
} from './responsePlanner'
import { selectFreshResponse } from './responseVariety'

const ACKNOWLEDGMENTS = Object.freeze({
  record_expense: [
    'Oke, pengeluarannya sudah aku pahami.',
    'Sip, rincian uang keluarnya sudah terbaca.',
    'Baik, aku sudah menangkap transaksi pengeluaran ini.',
    'Siap, pengeluaran ini sudah aku rangkum.',
  ],
  record_income: [
    'Oke, pemasukannya sudah aku pahami.',
    'Sip, rincian uang masuknya sudah terbaca.',
    'Baik, aku sudah menangkap transaksi pemasukan ini.',
    'Siap, pemasukan ini sudah aku rangkum.',
  ],
  record_multiple_transactions: [
    'Oke, aku menangkap beberapa transaksi sekaligus.',
    'Sip, semua rincian transaksinya sudah terbaca.',
    'Baik, aku sudah memisahkan transaksi-transaksi tadi.',
    'Siap, beberapa transaksi itu sudah aku rangkum.',
  ],
  transfer_money: [
    'Oke, perpindahan antar-dompetnya sudah aku pahami.',
    'Sip, rincian transfernya sudah terbaca.',
    'Baik, aku sudah menangkap dompet asal dan tujuannya.',
    'Siap, transfer antar-dompet ini sudah aku rangkum.',
  ],
  create_budget: [
    'Oke, rencana budgetnya sudah aku pahami.',
    'Sip, batas pengeluarannya sudah terbaca.',
    'Baik, aku sudah merangkum budget yang kamu inginkan.',
  ],
  update_budget: [
    'Oke, perubahan budgetnya sudah aku pahami.',
    'Sip, penyesuaian anggarannya sudah terbaca.',
    'Baik, aku sudah merangkum perubahan budget ini.',
  ],
  create_saving_goal: [
    'Oke, target tabungannya sudah aku pahami.',
    'Sip, tujuan menabungmu sudah terbaca.',
    'Baik, aku sudah merangkum target tabungan ini.',
  ],
  update_saving_goal: [
    'Oke, perubahan targetnya sudah aku pahami.',
    'Sip, penyesuaian target tabungannya sudah terbaca.',
    'Baik, aku sudah merangkum perubahan target ini.',
  ],
  query_balance: [
    'Ini posisi saldomu berdasarkan data terbaru.',
    'Aku sudah mengecek saldo yang tercatat.',
    'Berikut kondisi saldo yang bisa kulihat sekarang.',
  ],
  query_transactions: [
    'Aku sudah menelusuri transaksi yang tercatat.',
    'Ini ringkasan transaksi yang kutemukan.',
    'Berikut catatan transaksi terbarumu.',
  ],
  query_income: [
    'Aku sudah merangkum uang masukmu.',
    'Ini gambaran pemasukan dari data yang tercatat.',
    'Berikut hasil pengecekan pemasukannya.',
  ],
  query_expenses: [
    'Aku sudah merangkum uang keluarmu.',
    'Ini gambaran pengeluaran dari data yang tercatat.',
    'Berikut hasil pengecekan pengeluarannya.',
  ],
  query_spending_summary: [
    'Aku sudah melihat pola pengeluaranmu.',
    'Ini ringkasan uang keluar yang tercatat.',
    'Berikut gambaran belanjamu untuk periode tersebut.',
  ],
  query_category_summary: [
    'Aku sudah mengelompokkan transaksinya per kategori.',
    'Ini kategori yang terlihat dari catatanmu.',
    'Berikut ringkasan kategorinya.',
  ],
  query_wallet: [
    'Aku sudah mengecek dompet yang kamu maksud.',
    'Ini kondisi dompet tersebut berdasarkan data terbaru.',
    'Berikut rincian dompet yang tercatat.',
  ],
  query_budget: [
    'Aku sudah membandingkan budget dan pemakaiannya.',
    'Ini kondisi anggaranmu berdasarkan catatan terbaru.',
    'Berikut hasil pengecekan budgetnya.',
  ],
  query_saving_goal: [
    'Aku sudah melihat perkembangan target tabunganmu.',
    'Ini progres menabung yang tercatat.',
    'Berikut kondisi target tabunganmu sekarang.',
  ],
  financial_advice: [
    'Aku sudah melihat angkanya. Ini langkah yang paling masuk akal.',
    'Dari kondisi yang tercatat, aku menyarankan pendekatan berikut.',
    'Mari kita buat prioritasnya realistis berdasarkan datamu.',
  ],
  emotional_support: [
    'Aku dengar kekhawatiranmu. Kita lihat situasinya dengan kepala dingin.',
    'Kita urutkan kondisinya pelan-pelan supaya terasa lebih terkendali.',
    'Aku temani melihat angka yang ada dan menentukan langkah terdekat.',
  ],
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
  recentAssistantMessages = [],
} = {}) {
  const style = resolveCommunicationStyle(memory)
  const seed = `${intent}:${slots.amount || slots.items?.length || 0}:${status}`
  const plan = planAssistantResponse({
    intent,
    status,
    confidence,
    emotion,
    communicationStyle: style,
    hasInsight: Boolean(insight),
    hasPendingAction: Boolean(pendingAction),
    hasClarification: Boolean(clarification),
  })
  const components = applyResponsePlan({
    acknowledgment: selectAcknowledgment(intent, recentAssistantMessages, seed),
    empathy: composeEmpathy(emotion, status, recentAssistantMessages, seed),
    interpretation: composeInterpretation(intent, slots),
    details: composeDetails(intent, slots),
    insight: insight?.text || null,
    warning: composeWarning({
      confidence,
      status,
      recentAssistantMessages,
      seed,
    }),
    clarification: clarification?.question || null,
    confirmation: null,
    nextSuggestion: composeNextSuggestion(
      intent,
      status,
      recentAssistantMessages,
      seed
    ),
  }, plan)

  return {
    text: joinResponseComponents(components, style),
    components,
    plan,
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

function selectAcknowledgment(intent, recentAssistantMessages, seed) {
  const variants = ACKNOWLEDGMENTS[intent]
  if (!variants?.length) return null
  return selectFreshResponse(variants, {
    recentMessages: recentAssistantMessages,
    seed: `${seed}:acknowledgment`,
  })
}

function composeEmpathy(emotionalContext, status, recentAssistantMessages, seed) {
  if (status === 'clarification' && emotionalContext.emotion === 'confused') {
    return selectFreshResponse([
      'Tidak apa-apa, kita rapikan satu informasi dulu.',
      'Santai, kita lengkapi satu bagian dulu supaya hasilnya tepat.',
      'Aku bantu urutkan. Kita mulai dari detail yang masih kurang.',
    ], {
      recentMessages: recentAssistantMessages,
      seed: `${seed}:confused`,
    })
  }
  const variants = {
    worried: [
      'Kondisinya memang perlu dijaga dengan hati-hati.',
      'Aku paham kamu ingin memastikan uangnya tetap aman.',
    ],
    stressed: [
      'Aku paham ini terasa menekan; kita fokus ke angka yang bisa dikendalikan.',
      'Tarik napas dulu. Kita urutkan angkanya pelan-pelan.',
    ],
    regretful: [
      'Yang penting sekarang datanya dirapikan supaya langkah berikutnya lebih jelas.',
      'Tidak apa-apa, kita jadikan ini bahan untuk keputusan yang lebih baik berikutnya.',
    ],
    proud: [
      'Bagus, progresnya layak dipertahankan.',
      'Kerja bagus—kebiasaan seperti ini membantu keuangan tetap terarah.',
    ],
    motivated: [
      'Momentum ini bagus untuk dijadikan kebiasaan.',
      'Semangatnya sudah tepat; kita buat langkahnya tetap realistis.',
    ],
    urgent: [
      'Kita prioritaskan kebutuhan paling mendesak terlebih dahulu.',
      'Kita fokus dulu pada kebutuhan wajib dan ruang aman untuk beberapa hari ke depan.',
    ],
  }[emotionalContext.emotion]
  return variants
    ? selectFreshResponse(variants, {
        recentMessages: recentAssistantMessages,
        seed: `${seed}:empathy`,
      })
    : null
}

function composeInterpretation(intent, slots) {
  if (intent === 'calculate_change' && slots.tenderedAmount && slots.changeAmount) {
    const spent = slots.tenderedAmount - slots.changeAmount
    if (spent >= 0) {
      return `Dari uang ${formatRupiah(slots.tenderedAmount)} dan kembalian ${formatRupiah(slots.changeAmount)}, nilai belanjanya ${formatRupiah(spent)}.`
    }
  }
  if (intent === 'record_expense' || intent === 'record_income') {
    const direction = intent === 'record_income' ? 'Pemasukan' : 'Pengeluaran'
    const amount = slots.amount ? ` ${formatRupiah(slots.amount)}` : ''
    const description = slots.description
      ? ` dengan catatan "${slots.description}"`
      : ''
    const wallet = slots.wallet?.name
      ? `${intent === 'record_income' ? ' ke' : ' dari'} ${slots.wallet.name}`
      : ''
    return `${direction}${amount}${wallet}${description}.`
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

function composeWarning({ confidence, status, recentAssistantMessages, seed }) {
  if (status === 'blocked') {
    return selectFreshResponse([
      'Belum ada data keuangan yang aku ubah.',
      'Tenang, belum ada perubahan yang dijalankan.',
      'Data keuanganmu masih tetap; belum ada aksi yang dieksekusi.',
    ], {
      recentMessages: recentAssistantMessages,
      seed: `${seed}:blocked`,
    })
  }
  if (confidence > 0 && confidence < 0.62) {
    return selectFreshResponse([
      'Aku belum cukup yakin dengan maksudnya, jadi aku tidak akan menebak.',
      'Pesannya masih bisa ditafsirkan berbeda. Aku pilih memastikan dulu.',
      'Supaya catatanmu tetap akurat, aku perlu satu detail tambahan.',
    ], {
      recentMessages: recentAssistantMessages,
      seed: `${seed}:low-confidence`,
    })
  }
  return null
}

function composeNextSuggestion(intent, status, recentAssistantMessages, seed) {
  if (status === 'clarification') {
    return selectFreshResponse([
      'Cukup jawab bagian yang kutanyakan; detail sebelumnya tetap aku ingat.',
      'Kamu hanya perlu melengkapi informasi yang kurang, tidak perlu mengulang semuanya.',
      'Jawab singkat saja untuk bagian yang belum lengkap; konteks sebelumnya tetap tersimpan.',
    ], {
      recentMessages: recentAssistantMessages,
      seed: `${seed}:clarification`,
    })
  }
  if (intent === 'calculate_change') {
    return selectFreshResponse([
      'Kalau mau dicatat, beri tahu keterangannya dan dompet yang dipakai.',
      'Mau sekalian masuk pengeluaran? Sebutkan nama belanja dan dompetnya.',
      'Aku bisa lanjut menyiapkan catatannya setelah kamu menyebutkan keterangan dan dompet.',
    ], {
      recentMessages: recentAssistantMessages,
      seed: `${seed}:change`,
    })
  }
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
