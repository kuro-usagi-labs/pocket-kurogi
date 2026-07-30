import { inferMemoryCandidates } from './assistantMemory'
import { resolveConversationReferences } from './referenceResolver'
import {
  buildAssistantSemanticFrame,
  summarizeSemanticFrame,
} from './semanticFrame'

const LOCAL_FIRST_PATTERN =
  /\b(?:buat(?:kan)?|bikin(?:kan)?|tambah(?:kan)?)\s+(?:dompet|wallet|rekening)\b|\b(?:hapus|arsipkan|pulihkan|restore|rename|ganti nama|ubah nama)\s+(?:dompet|wallet|rekening)\b|\b(?:ajari|ajarkan|lupakan aturan|kalau (?:aku|saya) bilang)\b|\b(?:setor|cairkan|tarik)\b.{0,30}\b(?:target|tabungan)\b|\b(?:kembalian|susuk)\b/iu

export function orchestrateAssistantMessage({
  text = '',
  messages = [],
  wallets = [],
  categories = [],
  goals = [],
  memory = [],
  dialogueState = null,
  pendingAction = null,
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
  const engine = selectAssistantEngine({
    frame,
    text: referenceResolution.resolvedText,
    pendingAction,
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

  return {
    version: 1,
    originalText: referenceResolution.originalText,
    resolvedText: referenceResolution.resolvedText,
    referenceResolution,
    frame: {
      ...frame,
      engine,
    },
    preferredEngine: engine,
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

export function selectAssistantEngine({ frame, text, pendingAction }) {
  if (pendingAction) return 'deterministic'
  if (frame.dialogueAct === 'teaching') return 'local'
  if (LOCAL_FIRST_PATTERN.test(text)) return 'local'
  if (frame.intent === 'general_chat' || frame.intent === 'unknown') return 'local'
  if (
    frame.intent === 'calculate_change' ||
    (
      frame.intent === 'record_multiple_transactions' &&
      /\b(?:pakai|dari|bawa)\s+uang\b/iu.test(text)
    )
  ) {
    return 'local'
  }
  return 'deterministic'
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
