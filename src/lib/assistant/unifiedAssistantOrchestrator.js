import { inferMemoryCandidates } from './assistantMemory'
import { resolveConversationReferences } from './referenceResolver'
import {
  buildAssistantSemanticFrame,
  summarizeSemanticFrame,
} from './semanticFrame'
import { decideAssistantHandler } from './assistantDecisionPolicy'
import { extractLearningRuleCandidate } from './learningRuleExtractor'

export function orchestrateAssistantMessage({
  text = '',
  messages = [],
  wallets = [],
  archivedWallets = [],
  categories = [],
  goals = [],
  memory = [],
  categoryRules = [],
  walletRules = [],
  dialogueState = null,
  pendingAction = null,
  pendingMemoryProposal = null,
  memoryProposalDecision = null,
  financialState = {},
  now = new Date(),
} = {}) {
  const referenceResolution = resolveConversationReferences({
    text,
    messages,
    wallets,
    archivedWallets,
    memory,
    categoryRules,
    walletRules,
    dialogueState,
    pendingAction,
    now,
  })
  const frame = buildAssistantSemanticFrame({
    text: referenceResolution.resolvedText,
    originalText: referenceResolution.originalText,
    references: referenceResolution.references,
    wallets,
    archivedWallets,
    categories,
    goals,
    memory,
    categoryRules,
    walletRules,
    dialogueState,
    pendingAction,
    financialState,
    now,
  })
  const memoryCandidates = canProposeMemory({
    frame,
    pendingAction,
    text: referenceResolution.originalText,
  })
    ? inferMemoryCandidates({
        text: referenceResolution.originalText,
        resolvedWallet:
          frame.entities.wallets.find((wallet) => wallet.id) ||
          null,
        resolvedCategory: frame.entities.categories[0] || null,
        correction: frame.dialogueAct === 'correction',
        now,
      }).map((candidate) => ({
        ...candidate,
        displayValue: resolveMemoryDisplayValue(candidate, frame),
      }))
    : []
  const learningRuleCandidate = extractLearningRuleCandidate({
    text: referenceResolution.originalText,
    wallets,
    categories,
  })

  const decision = decideAssistantHandler({
    frame,
    canonicalPendingAction: pendingAction,
    pendingMemoryProposal,
    memoryProposalDecision,
    memoryCandidates,
    learningRuleCandidate,
  })

  return {
    version: 2,
    originalText: referenceResolution.originalText,
    resolvedText: referenceResolution.resolvedText,
    referenceResolution,
    frame,
    decision,
    memoryCandidates,
    learningRuleCandidate,
  }
}

export function attachAssistantUnderstanding(response, orchestration, {
  actualEngine = orchestration?.actualEngine || orchestration?.decision?.handler || null,
} = {}) {
  if (!response || !orchestration?.frame) return response
  return {
    ...response,
    metadata: {
      ...(response.metadata || {}),
      assistantUnderstanding: {
        ...summarizeSemanticFrame(orchestration.frame),
        engine: actualEngine,
      },
      assistantEngine: actualEngine,
      assistantProcessingDecision: orchestration.decision,
      assistantInputResolved:
        orchestration.resolvedText !== orchestration.originalText,
    },
  }
}

function canProposeMemory({ frame, pendingAction, text }) {
  if (pendingAction) return false
  const flags = frame.entities?.flags || {}
  if (
    flags.question ||
    flags.hypothetical ||
    flags.negated ||
    flags.thirdParty ||
    frame.safety?.blocksWrite
  ) {
    return false
  }

  return /\b(?:mulai sekarang|default|utama|biasanya|selalu|lebih sering|jawab|balas|respons|jelaskan|gajian|gaji masuk|anggap|masukkan)\b/iu.test(
    text
  )
}

function resolveMemoryDisplayValue(candidate, frame) {
  if (candidate.key === 'preferred_wallet') {
    return frame.entities.wallets.find(
      (wallet) => wallet.id === candidate.value
    )?.name || candidate.value
  }
  if (candidate.key === 'common_merchant_category') {
    return frame.entities.categories.find(
      (category) => category.id === candidate.value
    )?.name || candidate.value
  }
  return candidate.value
}
