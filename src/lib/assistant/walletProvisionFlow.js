import { runAssistantEngine } from './assistantEngine'
import { createDialogueState, isDialogueStateActive } from './conversationContext'
import { sanitizeWalletName } from './walletCreationParser'
import { createPendingAction } from './pendingActionManager'

// Only remove a trailing condition about wallet existence, never transaction negation.
export function splitWalletProvisionRequest(text = '') {
  const match = String(text).match(/[,;\s]+(?:jika|kalau|bila)\s+(?:dompet(?:nya)?\s+)?(?:tidak|belum|gak|ga)\s+ada\s*[,;]?\s*(?:tolong\s+)?(?:buatkan|buat|buatin|bikinkan|bikin)(?:\s+(?:dompet(?:nya)?|saja|aja|dong))?[.!]?$/iu)
  return match ? String(text).slice(0, match.index).trim() : null
}

function requestedWallet(text, context) {
  const explicit = text.match(/\b(?:ke|pakai|pake|dari)\s+(?:dompet|rekening|wallet)\s+([\p{L}\p{N} &'’-]{1,64})[.!]?$/iu)
  if (explicit) return sanitizeWalletName(explicit[1])
  if (context?.missingSlots?.includes('wallet') && /^[\p{L}\p{N} &'’-]{1,40}$/u.test(text.trim()) &&
    !/\b(?:hi|hai|halo|batal|jangan|tidak|belum|bukan|gak|ga|iya|ya|oke|saldo|berapa|catat|gaji|beli|bayar|tolong|buat|hapus|nanti|lupakan)\b/iu.test(text)) {
    return sanitizeWalletName(text.replace(/^(?:pakai|pake|dari|ke)\s+(?:(?:dompet|rekening)\s+)?/iu, ''))
  }
  return null
}

export function runWalletAwareTurn(input) {
  const original = input.originalText || input.text
  const stripped = splitWalletProvisionRequest(original)
  const context = isDialogueStateActive(input.dialogueState, input.now) ? input.dialogueState : null
  const text = stripped || original
  const name = requestedWallet(text, context)
  // A complete new statement must not inherit an older unfinished salary amount.
  if (name && /\d/u.test(text) && /\b(?:catat|pemasukan|pengeluaran|gaji|beli|bayar)\b/iu.test(text)) {
    input = { ...input, dialogueState: null }
  }
  const existing = (input.wallets || []).filter(w => !w.is_archived && w.name.toLowerCase() === name?.toLowerCase())
  if (!name || existing.length) {
    return runAssistantEngine(stripped || existing.length ? { ...input, text, semanticFrame: null } : input)
  }
  const probe = runAssistantEngine({ ...input, text, semanticFrame: null,
    wallets: [...(input.wallets || []), { id: 'unpersisted-wallet-probe', name, current_balance: 0 }],
  })
  if (!['record_income', 'record_expense'].includes(probe.route.intent) || !probe.safety.safe || !probe.slots.complete) {
    return runAssistantEngine(stripped ? { ...input, text, semanticFrame: null } : input)
  }
  const slots = { ...probe.slots.slots }
  delete slots.wallet
  const result = runAssistantEngine({ ...input, text: `buat dompet ${name} saldo awal Rp0`, semanticFrame: null, dialogueState: null })
  if (!result.pendingAction) return result
  // Persist the continuation in the hashed action so it survives reloads.
  const resumeTransaction = { intent: probe.route.intent, slots }
  result.pendingAction = createPendingAction({ ...result.pendingAction, payload: { ...result.pendingAction.payload, resumeTransaction }, now: input.now })
  result.dialogue.pendingAction = result.pendingAction
  result.response.text = `Dompet ${name} belum terdaftar. Buat dompet ini dengan saldo awal Rp0 dulu? Rincian ${slots.description || 'transaksi'} sebesar ${new Intl.NumberFormat('id-ID').format(slots.amount)} tetap disimpan dan akan dilanjutkan setelah dompet dibuat.\n\n${result.response.text}`
  return result
}

export function resumeWalletTransaction({ action, wallets, userId, sourceMessageId, now = new Date() }) {
  const resume = action?.payload?.resumeTransaction
  if (action?.actionType !== 'create_wallet' || !['record_income', 'record_expense'].includes(resume?.intent)) return null
  const matches = wallets.filter(w => !w.is_archived && w.name.toLowerCase() === action.payload.walletName.toLowerCase())
  if (matches.length !== 1) throw new Error('Dompet baru belum bisa ditemukan. Muat ulang sebelum melanjutkan transaksi.')
  return runAssistantEngine({ text: matches[0].name, userId, sourceMessageId, wallets, now,
    dialogueState: createDialogueState({ activeIntent: resume.intent, collectedSlots: resume.slots, missingSlots: ['wallet'], now }),
  })
}
