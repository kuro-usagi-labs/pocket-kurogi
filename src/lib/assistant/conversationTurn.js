import { orchestrateAssistantMessage } from './unifiedAssistantOrchestrator'
import { ASSISTANT_DECISION_HANDLERS } from './assistantDecisionPolicy'
import { detectThemeRequest } from './languageAssistant'
import { splitWalletProvisionRequest } from './walletProvisionFlow'
import { validateLanguageProposal } from './languageProposal'
import { isDialogueStateActive } from './conversationContext'

export async function resolveConversationTurn(input, { interpret }) {
  // Resume only a real, unexpired ownership clarification, never a model's
  // conversational promise or arbitrary history. Restage for confirmation.
  const ownershipText = input.dialogueState?.collectedSlots?.ownershipText
  if (!input.pendingAction && input.dialogueState?.missingSlots?.includes('payer') &&
      ownershipText && isDialogueStateActive(input.dialogueState, input.now) &&
      /^(?:(?:ya|iya)[,\s]+)?(?:(?:uang|duit|dana)\s+(?:saya|aku|gue|gw)|(?:saya|aku|gue|gw)(?:\s+yang)?(?:\s+(?:bayar|membayar))?)(?:\s+(?:lah|sendiri|kok))?[.!]*$/iu.test(input.text.trim())) {
    return orchestrateAssistantMessage({ ...input, text: ownershipText.split(/\r?\n/).map(line => `uang saya, ${line}`).join('\n'), dialogueState: null })
  }
  const baseline = orchestrateAssistantMessage(input)
  if (!input.pendingAction && !input.dialogueState?.missingSlots?.length &&
      /^(?:catat|simpan|rekam)\s+semua(?:nya)?[.!]?$/iu.test(input.text.trim())) {
    return { ...baseline, languageResponse: { text: 'Belum ada daftar transaksi aktif untuk dikonfirmasi. Kirim ulang daftar transaksi dalam satu pesan; aku akan menampilkan satu konfirmasi untuk semuanya.', metadata: { responseSource: 'local', conversationStatus: 'clarification' } } }
  }
  // A model proposal for a single transaction must not replace a bulk draft.
  if (baseline.frame.intent === 'record_multiple_transactions') return baseline
  // Persisted drafts, confirmations, cancellation, OCR and provisioning retain
  // their existing deterministic state machine. A model cannot execute a draft.
  if (input.pendingAction || input.pendingMemoryProposal || input.imageFile ||
      splitWalletProvisionRequest(input.text) ||
      baseline.decision.handler !== ASSISTANT_DECISION_HANDLERS.CANONICAL) return baseline
  const theme = detectThemeRequest(input.text)
  if (theme) return { ...baseline, theme }
  const safelyUnderstood = !['unknown', 'general_chat'].includes(baseline.frame.intent) &&
    !baseline.frame.ambiguous && !baseline.frame.missingSlots.length
  if (baseline.frame.safety.errors.some(e => e.code !== 'AMBIGUOUS_INTENT')) return baseline
  const needsCategory = ['record_income', 'record_expense'].includes(baseline.frame.intent) &&
    !baseline.frame.slots.category?.name && input.categories?.length
  if (safelyUnderstood && !needsCategory) return baseline
  try {
    const proposal = await interpret(input.text, input)
    if (!proposal) return baseline
    if (safelyUnderstood) {
      // Enrich only the category; never let classification change an already
      // understood amount, wallet, date, intent, or confirmation requirement.
      const validated = validateLanguageProposal({ proposal, text: input.text, context: input })
      if (validated.intent === baseline.frame.intent && validated.slots.category) {
        baseline.frame.slots.category = validated.slots.category
        baseline.responseSource = 'gemini_category'
      }
      return baseline
    }
    if (proposal.intent === 'set_theme') {
      const validated = validateLanguageProposal({ proposal, text: input.text, context: input })
      return { ...baseline, theme: validated.theme, responseSource: 'gemini' }
    }
    if (['general_chat', 'clarify'].includes(proposal.intent)) {
      // Do not let conversation replace a partially understood financial draft.
      if (baseline.frame.action.mutates || input.dialogueState?.missingSlots?.length) return baseline
      return { ...baseline, languageResponse: { text: proposal.reply || 'Bisa jelaskan sedikit lagi?', metadata: { responseSource: 'gemini' } } }
    }
    const candidate = orchestrateAssistantMessage({ ...input, languageProposal: proposal })
    if (candidate.frame.safety.blocksWrite) return baseline
    return { ...candidate, responseSource: 'gemini' }
  } catch { return baseline }
}
