import { ASSISTANT_INTENTS } from './intentDefinitions'
import { clampNumber } from './formatters'

const SIGNALS = Object.freeze({
  recordVerb: /\b(?:catat|simpan|rekam|input|masukkan|tambahkan)\b/iu,
  expenseVerb: /\b(?:beli|bayar|belanja|jajan|makan|minum|habis|keluar)\b/iu,
  incomeVerb: /\b(?:terima|menerima|dapat|gaji|bonus|pemasukan|pendapatan|cashback|refund|komisi)\b/iu,
  transferVerb: /\b(?:transfer|trf|tf|pindah|pindahkan|kirim|geser)\b/iu,
  change: /\b(?:kembalian|kembali|susuk|bayar pakai|uangnya)\b/iu,
  balance: /\b(?:saldo|uang tersisa|sisa uang|total uang|uangku|uang saya)\b/iu,
  transaction: /\b(?:transaksi|riwayat|catatan)\b/iu,
  income: /\b(?:pemasukan|pendapatan|income|gaji|bonus)\b/iu,
  expense: /\b(?:pengeluaran|spending|belanja|boros|habis)\b/iu,
  summary: /\b(?:ringkasan|rekap|total|analisis|analisa|bagaimana|gimana)\b/iu,
  weeklySummary: /\b(?:ringkasan|rekap|laporan)\b.{0,30}\b(?:minggu|pekan|mingguan)\b|\b(?:minggu|pekan)\s+ini\b.{0,30}\b(?:ringkas|rekap|laporan)\b/iu,
  queryVerb: /\b(?:cek|lihat|tampilkan|tunjukkan|berapa)\b/iu,
  category: /\b(?:kategori|pos|paling besar|terbesar|terbanyak)\b/iu,
  wallet: /\b(?:dompet|rekening|wallet)\b/iu,
  budget: /\b(?:budget|anggaran|jatah|batas)\b/iu,
  savingGoal: /\b(?:target|goal|tabungan|menabung|nabung)\b/iu,
  create: /\b(?:buat(?:kan)?|buatin|membuat(?:kan)?|bikin(?:kan)?|bikinin|tambahkan|tambah(?:kan|in)?|pasang)\b/iu,
  update: /\b(?:ubah(?:kan|in)?|ganti(?:kan|in)?|update|naikkan|naikin|turunkan|turunin|revisi)\b/iu,
  renameWallet: /\b(?:rename|ganti nama|ubah nama)\b/iu,
  archiveWallet: /\b(?:hapus|buang|delete|hilangkan|arsipkan)\b/iu,
  restoreWallet: /\b(?:pulihkan|kembalikan|restore|aktifkan kembali)\b/iu,
  goalDeposit: /\b(?:setor|tabung|nabung|sisih|simpan|alokasi|masukkan|masukin)\b/iu,
  goalWithdrawal: /\b(?:cairkan|tarik|ambil)\b/iu,
  advice: /\b(?:saran|strategi|rekomendasi|sebaiknya|menurutmu|aman|cukup|atur|hemat|prioritas)\b/iu,
  affordability: /\b(?:boleh(?:kah)?|aman|mampu|cukup)\b.{0,45}\b(?:beli|bayar|ambil)\b|\b(?:beli|bayar|ambil)\b.{0,45}\b(?:boleh|aman|mampu|cukup)\b/iu,
  recurringAdvice: /\b(?:pembayaran|transaksi|pengeluaran)?\s*(?:berulang|langganan|subscription|rutin)\b/iu,
  goalForecast: /\b(?:kapan|prediksi|perkiraan)\b.{0,50}\b(?:target|tabungan|simpanan)\b|\b(?:target|tabungan|simpanan)\b.{0,50}\b(?:kapan|tercapai|selesai|sesuai jalur|on track)\b/iu,
  unusualSpending: /\b(?:pengeluaran|belanja)\b.{0,35}\b(?:tidak biasa|nggak biasa|naik|melonjak|boros)\b|\b(?:boros|lonjakan)\b.{0,35}\b(?:pengeluaran|belanja)\b/iu,
  planningCalendar: /\b(?:jadwal|tagihan|gajian|setoran)\b.{0,45}\b(?:mendatang|berikutnya|dekat|jatuh tempo|kapan)\b|\b(?:apa|yang)\s+(?:akan|bakal)\s+(?:masuk|keluar|jatuh tempo)\b/iu,
  correction: /\b(?:koreksi|revisi|ubah|ganti|harusnya|seharusnya|yang tadi)\b/iu,
  confirm: /^(?:ya|iya|yup|betul|benar|oke|ok|sip|setuju|konfirmasi|lanjut|gas)(?:\s+(?:boleh|catat|konfirmasi|setujui|lanjut(?:kan)?|saja|aja|sekarang))?$/iu,
  contextualConfirm: /^(?:(?:ya|iya|oke|sip)\s+)?(?:catat|simpan|rekam)(?:\s+(?:transaksi|catatan|draft))?\s+(?:(?:yang\s+)?(?:tadi|itu|tersebut|barusan))$/iu,
  contextualCorrection: /^(?:jadi|harusnya|seharusnya)\s+(?:rp\s*)?\d+(?:[.,]\d+)?\s*(?:rb|ribu|k|jt|juta)?$/iu,
  cancel: /\b(?:batal|batalkan|jangan jadi|tidak jadi|urungkan|cancel|lupakan)\b/iu,
  greeting: /^(?:halo|hai|hi|pagi|siang|sore|malam|apa kabar)\b/iu,
  emotional: /\b(?:stres|stress|khawatir|cemas|takut|menyesal|nyesel|bingung|pusing|bangga|senang|semangat|panik|tertekan|boros banget|uang menipis|saldo tinggal|sisa uang)\b/iu,
})

export function routeAssistantIntent({
  text = '',
  entities = {},
  dialogueState = null,
} = {}) {
  const normalizedText = entities.normalizedText || String(text || '').toLowerCase()
  const scores = new Map()

  for (const intent of ASSISTANT_INTENTS) {
    scores.set(intent, createScoreEntry(intent))
  }

  scoreDialogueActs(scores, normalizedText, entities, dialogueState)
  scoreMutations(scores, normalizedText, entities)
  scoreQueries(scores, normalizedText, entities)
  scoreSupport(scores, normalizedText, entities)
  scoreSpecialistCandidates(scores, entities)

  if (entities.question || entities.hypothetical) {
    penalizeMutationIntents(scores, entities)
  }

  if (entities.thirdParty) {
    addConflict(scores, ['record_expense', 'record_income', 'record_multiple_transactions'], 'third_party_ownership', 0.48)
  }

  if (entities.negated && !entities.cancellation) {
    addConflict(scores, ['record_expense', 'record_income', 'record_multiple_transactions', 'transfer_money'], 'negated_action', 0.32)
  }

  const ranked = Array.from(scores.values())
    .map(finalizeScore)
    .sort((left, right) => right.score - left.score)
  const best = ranked[0]
  const runnerUp = ranked[1]
  const margin = best.score - runnerUp.score
  const ambiguous = best.score < 0.46 || (runnerUp.score >= 0.42 && margin < 0.12)

  if (best.score <= 0.12) {
    return {
      intent: 'unknown',
      score: 0,
      margin: 0,
      evidence: [],
      conflictingEvidence: [],
      ambiguous: true,
      alternatives: ranked.slice(0, 3),
    }
  }

  return {
    intent: ambiguous ? 'unknown' : best.intent,
    score: best.score,
    margin,
    evidence: best.evidence,
    conflictingEvidence: best.conflictingEvidence,
    ambiguous,
    alternatives: ranked.slice(0, 3),
  }
}

function scoreSpecialistCandidates(scores, entities) {
  for (const candidate of entities.specialistCandidates || []) {
    const intent = {
      compound_purchase: candidate.fields?.items?.length > 1
        ? 'record_multiple_transactions'
        : 'record_expense',
      incoming_transfer: 'record_income',
      runway_scenario: 'financial_advice',
      goal_with_opening_deposit: 'create_saving_goal',
      saving_simulation: 'financial_advice',
    }[candidate.kind]
    if (!intent) continue
    add(scores, intent, Math.max(0.82, candidate.confidence), `specialist:${candidate.kind}`)
    if (candidate.kind === 'incoming_transfer') {
      addConflict(scores, ['transfer_money'], 'specialist:incoming_ownership', 0.62)
    }
    if (candidate.kind === 'compound_purchase') {
      addConflict(scores, ['calculate_change', 'record_income'], 'specialist:item_prices', 0.45)
    }
    if (candidate.kind === 'goal_with_opening_deposit') {
      addConflict(scores, ['record_multiple_transactions'], 'specialist:goal_funding', 0.55)
    }
    if (candidate.kind === 'runway_scenario') {
      addConflict(scores, ['emotional_support'], 'specialist:explicit_runway', 0.22)
    }
    if (candidate.kind === 'saving_simulation') {
      addConflict(scores, ['create_saving_goal', 'deposit_goal', 'record_expense'], 'specialist:simulation_not_mutation', 0.72)
    }
  }
}

function scoreDialogueActs(scores, text, entities, state) {
  if (state?.activeIntent && (entities.cancellation || SIGNALS.cancel.test(text))) {
    add(scores, 'cancel_pending_action', 0.98, 'dialogue_state:cancellation')
  }
  if (state?.pendingActionId || state?.pendingAction?.id) {
    if (entities.confirmation || SIGNALS.confirm.test(text) || SIGNALS.contextualConfirm.test(text)) {
      add(scores, 'confirm_pending_action', 0.96, 'pending_action:affirmative')
    }
    if (entities.cancellation || SIGNALS.cancel.test(text)) {
      add(scores, 'cancel_pending_action', 0.98, 'pending_action:cancellation')
    }
    if (
      !SIGNALS.contextualConfirm.test(text) &&
      (SIGNALS.correction.test(text) || SIGNALS.contextualCorrection.test(text))
    ) {
      add(scores, 'correct_pending_action', 0.86, 'pending_action:correction')
    }
    if (state.missingSlots?.includes('wallet') && entities.wallets?.[0]?.id) {
      add(scores, 'select_wallet', 0.9, 'pending_slot:wallet')
    }
  }
}

function scoreMutations(scores, text, entities) {
  const amountCount = entities.amounts?.length || 0
  const hasRecordVerb = SIGNALS.recordVerb.test(text)

  if (entities.walletCreation?.isCreationRequest) {
    if (entities.archivedWallets?.[0]?.id) {
      add(scores, 'restore_wallet', 0.98, 'archived_wallet_reuse')
    } else {
      add(scores, 'create_wallet', 0.94, 'wallet_creation_request')
    }
  }
  if (SIGNALS.wallet.test(text) && SIGNALS.renameWallet.test(text)) {
    add(scores, 'rename_wallet', 0.9, 'wallet_rename_request')
  }
  if (SIGNALS.wallet.test(text) && SIGNALS.archiveWallet.test(text)) {
    add(scores, 'archive_wallet', 0.9, 'wallet_archive_request')
  }
  if (SIGNALS.wallet.test(text) && SIGNALS.restoreWallet.test(text)) {
    add(scores, 'restore_wallet', 0.92, 'wallet_restore_request')
  }

  const mentionsGoal = SIGNALS.savingGoal.test(text) && Boolean(entities.goals?.[0]?.id)
  const goalTransferDirection = resolveGoalTransferDirection(
    text,
    entities.goals?.[0]?.name
  )
  if (mentionsGoal && SIGNALS.goalWithdrawal.test(text)) {
    add(scores, 'withdraw_goal', 0.92, 'goal_withdrawal_request')
    addConflict(scores, ['transfer_money'], 'goal_withdrawal_context', 0.5)
  } else if (
    mentionsGoal &&
    (SIGNALS.goalDeposit.test(text) || SIGNALS.transferVerb.test(text)) &&
    goalTransferDirection === 'deposit'
  ) {
    add(scores, 'deposit_goal', 0.92, 'goal_deposit_request')
    addConflict(scores, ['transfer_money'], 'goal_deposit_context', 0.5)
  } else if (
    mentionsGoal &&
    SIGNALS.transferVerb.test(text) &&
    goalTransferDirection === 'withdraw'
  ) {
    add(scores, 'withdraw_goal', 0.92, 'goal_withdrawal_transfer_request')
    addConflict(scores, ['transfer_money'], 'goal_withdrawal_context', 0.5)
  }

  if (SIGNALS.expenseVerb.test(text)) {
    add(scores, 'record_expense', 0.28, 'expense_verb')
  }
  if (SIGNALS.incomeVerb.test(text)) {
    add(scores, 'record_income', 0.3, 'income_verb')
  }
  if (hasRecordVerb) {
    add(scores, 'record_expense', 0.25, 'record_verb')
    add(scores, 'record_income', 0.2, 'record_verb')
  }
  if (hasRecordVerb && SIGNALS.income.test(text)) {
    add(scores, 'record_income', 0.38, 'explicit_income_label')
    addConflict(scores, ['record_expense'], 'explicit_income_label', 0.28)
  }
  if (hasRecordVerb && SIGNALS.expense.test(text)) {
    add(scores, 'record_expense', 0.38, 'explicit_expense_label')
    addConflict(scores, ['record_income'], 'explicit_expense_label', 0.28)
  }
  if (amountCount === 1) {
    add(scores, 'record_expense', 0.18, 'money:single')
    add(scores, 'record_income', 0.18, 'money:single')
  }
  if (amountCount > 1 && /(?:,|\bdan\b|\blalu\b|\bterus\b)/iu.test(text)) {
    add(scores, 'record_multiple_transactions', 0.5, `money:multiple:${amountCount}`)
    if (hasRecordVerb) add(scores, 'record_multiple_transactions', 0.25, 'record_verb')
  }

  if (SIGNALS.transferVerb.test(text)) {
    add(scores, 'transfer_money', 0.48, 'transfer_verb')
    if (entities.transferWallets?.source) add(scores, 'transfer_money', 0.2, 'source_wallet')
    if (entities.transferWallets?.destination) add(scores, 'transfer_money', 0.2, 'destination_wallet')
    if (amountCount === 1) add(scores, 'transfer_money', 0.16, 'money:single')
  }

  if (SIGNALS.change.test(text) && amountCount >= 2) {
    add(scores, 'calculate_change', 0.75, 'change_arithmetic')
  }

  if (SIGNALS.budget.test(text) && SIGNALS.create.test(text)) {
    add(scores, 'create_budget', 0.78, 'create_budget')
    addConflict(
      scores,
      ['record_expense', 'record_income', 'record_multiple_transactions'],
      'budget_creation_context',
      0.32
    )
  }
  if (SIGNALS.budget.test(text) && SIGNALS.update.test(text)) {
    add(scores, 'update_budget', 0.78, 'update_budget')
    addConflict(
      scores,
      ['record_expense', 'record_income', 'record_multiple_transactions'],
      'budget_update_context',
      0.32
    )
  }
  if (SIGNALS.savingGoal.test(text) && SIGNALS.create.test(text)) {
    add(scores, 'create_saving_goal', 0.66, 'create_saving_goal')
  }
  if (SIGNALS.savingGoal.test(text) && SIGNALS.update.test(text)) {
    add(scores, 'update_saving_goal', 0.66, 'update_saving_goal')
  }
}

function resolveGoalTransferDirection(text, goalName) {
  const normalizedGoal = String(goalName || '').trim()
  if (!normalizedGoal) return null
  const escapedGoal = normalizedGoal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const goalReference = `(?:target|goal|tabungan|simpanan|milestone)?\\s*${escapedGoal}`
  if (new RegExp(`\\b(?:ke|menuju|buat|untuk)\\s+${goalReference}\\b`, 'iu').test(text)) {
    return 'deposit'
  }
  if (new RegExp(`\\bdari\\s+${goalReference}\\b`, 'iu').test(text)) {
    return 'withdraw'
  }
  return null
}

function scoreQueries(scores, text, entities) {
  if (
    !entities.question &&
    !SIGNALS.summary.test(text) &&
    !SIGNALS.advice.test(text) &&
    !SIGNALS.queryVerb.test(text)
  ) return

  if (SIGNALS.balance.test(text)) add(scores, 'query_balance', 0.78, 'balance_question')
  if (SIGNALS.weeklySummary.test(text)) add(scores, 'query_spending_summary', 0.88, 'weekly_summary_request')
  if (SIGNALS.transaction.test(text)) add(scores, 'query_transactions', 0.7, 'transaction_query')
  if (SIGNALS.income.test(text)) add(scores, 'query_income', 0.62, 'income_query')
  if (SIGNALS.expense.test(text)) add(scores, 'query_expenses', 0.62, 'expense_query')
  if (SIGNALS.summary.test(text) && SIGNALS.expense.test(text)) {
    add(scores, 'query_spending_summary', 0.72, 'spending_summary_query')
  }
  if (SIGNALS.category.test(text)) add(scores, 'query_category_summary', 0.68, 'category_query')
  if (SIGNALS.wallet.test(text) && entities.wallets?.[0]?.id) {
    add(scores, 'query_wallet', 0.72, 'wallet_query')
  }
  if (SIGNALS.budget.test(text) && !SIGNALS.create.test(text) && !SIGNALS.update.test(text)) {
    add(scores, 'query_budget', 0.76, 'budget_query')
  }
  if (SIGNALS.savingGoal.test(text) && !SIGNALS.create.test(text) && !SIGNALS.update.test(text)) {
    add(scores, 'query_saving_goal', 0.72, 'saving_goal_query')
  }
}

function scoreSupport(scores, text, entities) {
  if (SIGNALS.planningCalendar.test(text)) {
    add(scores, 'financial_advice', 0.9, 'planning_calendar_query')
    addConflict(scores, ['record_expense', 'record_income'], 'calendar_query_not_transaction', 0.62)
  }
  if (SIGNALS.affordability.test(text)) {
    add(scores, 'financial_advice', 0.92, 'affordability_question')
    addConflict(scores, ['record_expense', 'record_income'], 'question_not_transaction', 0.7)
  }
  if (SIGNALS.recurringAdvice.test(text)) {
    add(scores, 'financial_advice', 0.86, 'recurring_payment_analysis')
    addConflict(scores, ['query_transactions'], 'recurring_pattern_not_transaction_list', 0.42)
  }
  if (SIGNALS.goalForecast.test(text)) {
    add(scores, 'financial_advice', 0.88, 'goal_forecast_request')
    addConflict(scores, ['query_saving_goal'], 'forecast_not_static_goal_query', 0.35)
  }
  if (SIGNALS.unusualSpending.test(text)) {
    add(scores, 'financial_advice', 0.86, 'unusual_spending_analysis')
  }
  if (SIGNALS.advice.test(text)) {
    add(scores, 'financial_advice', 0.68, 'advice_request')
  }
  if (SIGNALS.emotional.test(text)) {
    add(scores, 'emotional_support', 0.72, 'emotional_cue')
    if (SIGNALS.expense.test(text) || SIGNALS.balance.test(text)) {
      add(scores, 'emotional_support', 0.15, 'financial_concern')
    }
  }
  if (SIGNALS.greeting.test(text)) {
    add(scores, 'general_chat', 0.78, 'greeting')
  }
  if (
    !entities.amounts?.length &&
    !entities.wallets?.length &&
    !SIGNALS.transaction.test(text) &&
    !SIGNALS.balance.test(text) &&
    !SIGNALS.budget.test(text) &&
    !SIGNALS.savingGoal.test(text) &&
    text.length > 0
  ) {
    add(scores, 'general_chat', 0.18, 'non_financial_text')
  }
}

function penalizeMutationIntents(scores, entities) {
  const reason = entities.hypothetical ? 'hypothetical_or_future' : 'question_form'
  const penalty = entities.hypothetical ? 0.5 : 0.34
  addConflict(
    scores,
    [
      'record_expense',
      'record_income',
      'record_multiple_transactions',
      'transfer_money',
      'create_wallet',
      'rename_wallet',
      'archive_wallet',
      'restore_wallet',
      'deposit_goal',
      'withdraw_goal',
      'create_budget',
      'update_budget',
      'create_saving_goal',
      'update_saving_goal',
    ],
    reason,
    penalty
  )
}

function createScoreEntry(intent) {
  return {
    intent,
    positive: 0,
    negative: 0,
    evidence: [],
    conflictingEvidence: [],
  }
}

function add(scores, intent, amount, evidence) {
  const entry = scores.get(intent)
  entry.positive += amount
  entry.evidence.push(evidence)
}

function addConflict(scores, intents, evidence, amount) {
  for (const intent of intents) {
    const entry = scores.get(intent)
    entry.negative += amount
    entry.conflictingEvidence.push(evidence)
  }
}

function finalizeScore(entry) {
  return {
    intent: entry.intent,
    score: clampNumber(entry.positive - entry.negative),
    evidence: [...new Set(entry.evidence)],
    conflictingEvidence: [...new Set(entry.conflictingEvidence)],
  }
}
