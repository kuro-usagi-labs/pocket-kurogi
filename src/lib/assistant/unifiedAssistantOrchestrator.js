import { inferMemoryCandidates } from './assistantMemory'
import { resolveConversationReferences } from './referenceResolver'
import {
  buildAssistantSemanticFrame,
  summarizeSemanticFrame,
} from './semanticFrame'
import { decideAssistantHandler } from './assistantDecisionPolicy'

export function orchestrateAssistantMessage({
  text = '',
  messages = [],
  wallets = [],
  categories = [],
  goals = [],
  memory = [],
  dialogueState = null,
  pendingAction = null,
  legacyPendingAction = null,
  pendingMemoryProposal = null,
  memoryProposalDecision = null,
  financialState = {},
  now = new Date(),
} = {}) {
  const referenceResolution = resolveConversationReferences({
    text,
    messages,
    wallets,
    memory,
    dialogueState,
    now,
  })
  const frame = buildAssistantSemanticFrame({
    text: referenceResolution.resolvedText,
    originalText: referenceResolution.originalText,
    references: referenceResolution.references,
    wallets,
    categories,
    goals,
    memory,
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

  const decision = decideAssistantHandler({
    frame,
    canonicalPendingAction: pendingAction,
    legacyPendingAction,
    pendingMemoryProposal,
    memoryProposalDecision,
    memoryCandidates,
  })

  return {
    version: 2,
    originalText: referenceResolution.originalText,
    resolvedText: referenceResolution.resolvedText,
    referenceResolution,
    frame,
    decision,
    // Temporary compatibility metadata. Runtime routing uses decision.handler.
    preferredEngine: decision.handler === 'canonical_pipeline'
      ? 'deterministic'
      : 'local',
    memoryCandidates,
  }
}

export function attachAssistantUnderstanding(response, orchestration, {
  actualEngine = orchestration?.actualEngine ||
    orchestration?.preferredEngine ||
    null,
} = {}) {
  if (!response || !orchestration?.frame) return response
  return {
    ...response,
    metadata: {
      ...(response.metadata || {}),
      assistantUnderstanding: {
        ...summarizeSemanticFrame(orchestration.frame),
        engine: actualEngine,
        preferredEngine: orchestration.preferredEngine,
      },
      assistantEngine: actualEngine,
      assistantPreferredEngine: orchestration.preferredEngine,
      assistantInputResolved:
        orchestration.resolvedText !== orchestration.originalText,
    },
  }
}

export function selectAssistantEngine({ frame, pendingAction }) {
  return decideAssistantHandler({
    frame,
    canonicalPendingAction: pendingAction,
  }).handler === 'canonical_pipeline'
    ? 'deterministic'
    : 'local'
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
