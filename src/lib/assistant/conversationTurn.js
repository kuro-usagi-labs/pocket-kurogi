import { orchestrateAssistantMessage } from './unifiedAssistantOrchestrator'
import { ASSISTANT_DECISION_HANDLERS } from './assistantDecisionPolicy'
import { detectThemeRequest } from './languageAssistant'
import { splitWalletProvisionRequest } from './walletProvisionFlow'

export async function resolveConversationTurn(input, { interpret }) {
  const baseline = orchestrateAssistantMessage(input)
  // Persisted drafts, confirmations, cancellation, OCR and provisioning retain
  // their existing deterministic state machine. A model cannot execute a draft.
  if (input.pendingAction || input.pendingMemoryProposal || input.imageFile ||
      splitWalletProvisionRequest(input.text) ||
      baseline.decision.handler !== ASSISTANT_DECISION_HANDLERS.CANONICAL) return baseline
  const theme = detectThemeRequest(input.text)
  if (theme) return { ...baseline, theme }
  const safelyUnderstood = !['unknown', 'general_chat'].includes(baseline.frame.intent) &&
    !baseline.frame.ambiguous && !baseline.frame.missingSlots.length
  if (safelyUnderstood || baseline.frame.safety.errors.some(e => e.code !== 'AMBIGUOUS_INTENT')) return baseline
  try {
    const proposal = await interpret(input.text, input)
    if (!proposal) return baseline
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
