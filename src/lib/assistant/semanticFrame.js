import { detectEmotionalContext } from './emotionalContext'
import { extractAssistantEntities } from './entityExtractor'
import {
  getIntentDefinition,
  toCanonicalAssistantIntent,
} from './intentDefinitions'
import { routeAssistantIntent } from './intentRouter'
import { resolveIntentSlots } from './slotResolver'
import { validateAssistantInterpretation } from './safetyValidator'
import {
  getChatWriteCandidate,
  isChatWriteIntentType,
} from '../chatWriteSafety'

const SEMANTIC_FRAME_ANALYSIS = Symbol('semanticFrameAnalysis')

export function buildAssistantSemanticFrame({
  text = '',
  originalText = text,
  references = [],
  wallets = [],
  categories = [],
  goals = [],
  memory = [],
  dialogueState = null,
  pendingAction = null,
  financialState = {},
  now = new Date(),
} = {}) {
  const entities = extractAssistantEntities({
    text,
    wallets,
    categories,
    goals,
    memory,
    now,
  })
  const route = routeAssistantIntent({
    text,
    entities,
    dialogueState: pendingAction
      ? {
          ...(dialogueState || {}),
          pendingActionId: pendingAction.id,
          pendingAction,
        }
      : dialogueState,
  })
  const slots = resolveIntentSlots({
    intent: route.intent,
    entities,
    dialogueState,
    text,
  })
  const safety = validateAssistantInterpretation({
    intent: route.intent,
    entities,
    slots: slots.slots,
    route,
  })
  const definition = getIntentDefinition(route.intent)
  const emotion = detectEmotionalContext(originalText, financialState)
  const localAction = detectLocalAssistantAction(entities.normalizedText)
  const attemptedMutation = detectAttemptedMutation(
    entities.normalizedText,
    entities,
    definition,
    localAction
  )
  const contextualSafetyErrors = buildContextualSafetyErrors(
    entities,
    attemptedMutation
  )
  const combinedErrors = [
    ...(safety.errors || []),
    ...contextualSafetyErrors,
  ]
  const dialogueAct = detectDialogueAct({
    text: entities.normalizedText,
    entities,
    intent: route.intent,
  })

  const frame = {
    version: 2,
    utterance: {
      original: String(originalText || ''),
      resolved: String(text || ''),
      normalized: entities.normalizedText,
    },
    dialogueAct,
    intent: route.intent,
    canonicalIntent: toCanonicalAssistantIntent(route.intent),
    legacyIntent: route.intent,
    confidence: route.score,
    ambiguous: route.ambiguous,
    evidence: route.evidence || [],
    conflicts: route.conflictingEvidence || [],
    action: {
      kind: definition.mutates || localAction?.mutates || attemptedMutation
        ? 'mutation'
        : definition.queryType
          ? 'query'
          : route.intent === 'calculate_change'
            ? 'calculation'
            : 'conversation',
      actionType: definition.actionType || localAction?.actionType || null,
      queryType: definition.queryType || null,
      mutates: Boolean(
        definition.mutates ||
        localAction?.mutates ||
        attemptedMutation
      ),
      requiresConfirmation: Boolean(
        definition.mutates ||
        localAction?.mutates ||
        attemptedMutation
      ),
    },
    slots: slots.slots,
    missingSlots: slots.missingSlots,
    entities: summarizeEntities(entities),
    references,
    emotion,
    safety: {
      safe: safety.safe && contextualSafetyErrors.length === 0,
      errors: combinedErrors,
      warnings: safety.warnings || [],
      blocksWrite: Boolean(
        (definition.mutates || attemptedMutation) &&
        (!safety.safe || contextualSafetyErrors.length > 0)
      ),
    },
  }

  Object.defineProperty(frame, SEMANTIC_FRAME_ANALYSIS, {
    value: Object.freeze({
      entities,
      route,
      slotResult: slots,
      safety,
      emotion,
    }),
    enumerable: false,
  })

  return frame
}

export function getSemanticFrameAnalysis(frame) {
  return frame?.[SEMANTIC_FRAME_ANALYSIS] || null
}

function detectAttemptedMutation(text, entities, definition, localAction) {
  if (definition.mutates || localAction?.mutates) return true
  const hasFinancialEntity =
    (entities.amounts?.length || 0) > 0 ||
    (entities.wallets?.length || 0) > 0
  const mutationLanguage =
    /\b(?:catat|simpan|rekam|input|masukkan|tambahkan|beli|bayar|belanja|jajan|terima|gaji|bonus|transfer|pindahkan|buat(?:kan)?|bikin(?:kan)?|ubah|ganti)\b/iu.test(
      text
    )
  return hasFinancialEntity && mutationLanguage
}

function buildContextualSafetyErrors(entities, attemptedMutation) {
  if (!attemptedMutation) return []
  const errors = []
  if (entities.hypothetical) {
    errors.push({
      code: 'HYPOTHETICAL_OR_FUTURE',
      message: 'Pernyataan hipotetis tidak boleh dijalankan sebagai transaksi.',
    })
  }
  if (entities.thirdParty) {
    errors.push({
      code: 'THIRD_PARTY_OWNERSHIP',
      message: 'Transaksi pihak lain tidak boleh dicatat sebagai milik pengguna.',
    })
  }
  if (entities.negated && !entities.cancellation) {
    errors.push({
      code: 'NEGATED_ACTION',
      message: 'Aksi yang dinegasikan tidak boleh dijalankan.',
    })
  }
  if (entities.question) {
    errors.push({
      code: 'QUESTION_NOT_ACTION',
      message: 'Pertanyaan tidak boleh dijalankan sebagai perintah.',
    })
  }
  return errors
}

export function reconcileSemanticFrameWithLocalAnalysis(frame, analysis) {
  if (!frame) {
    return {
      frame,
      executionAllowed: false,
      reason: 'missing_semantic_frame',
    }
  }

  const writeCandidate = getChatWriteCandidate(analysis)
  const isMutation = isChatWriteIntentType(writeCandidate?.type)
  if (!isMutation) {
    return {
      frame,
      executionAllowed: true,
      reason: null,
    }
  }

  const writeAuthorized = writeCandidate.writeDecision === 'commit'
  const requiresFollowupConfirmation =
    requiresLocalFollowupConfirmation(analysis, writeCandidate.type)
  const frameErrors = frame.safety?.errors || []
  const routingErrors = frameErrors.filter(
    (error) => error.code === 'AMBIGUOUS_INTENT'
  )
  const unresolvedSafetyErrors = frameErrors.filter(
    (error) => error.code !== 'AMBIGUOUS_INTENT'
  )
  const safetyBlocksWrite = unresolvedSafetyErrors.length > 0
  const actionType = writeCandidate.type
  const reconciledFrame = {
    ...frame,
    intent:
      frame.intent === 'unknown' || frame.intent === 'general_chat'
        ? `local_${actionType}`
        : frame.intent,
    action: {
      ...frame.action,
      kind: 'mutation',
      actionType,
      mutates: true,
      requiresConfirmation: requiresFollowupConfirmation,
      writeDecision: writeAuthorized ? 'commit' : 'review',
    },
    safety: {
      ...frame.safety,
      safe: unresolvedSafetyErrors.length === 0 && writeAuthorized,
      blocksWrite: safetyBlocksWrite || !writeAuthorized,
      errors: [
        ...unresolvedSafetyErrors,
        ...(!writeAuthorized
          ? [{
              code: 'LOCAL_WRITE_NOT_AUTHORIZED',
              message:
                'Parser lokal belum memberi keputusan tulis yang eksplisit.',
            }]
          : []),
      ],
      warnings: [
        ...(frame.safety?.warnings || []),
        ...routingErrors,
      ],
    },
  }

  return {
    frame: reconciledFrame,
    executionAllowed: writeAuthorized && !safetyBlocksWrite,
    reason: safetyBlocksWrite
      ? 'semantic_safety_blocked'
      : writeAuthorized
        ? null
        : 'local_write_not_authorized',
  }
}

function requiresLocalFollowupConfirmation(analysis, actionType) {
  if (analysis?.type === 'needs_confirmation') return true
  return ['delete_wallet', 'restore_wallet'].includes(actionType)
}

function detectLocalAssistantAction(text) {
  const rules = [
    {
      actionType: 'create_wallet',
      pattern:
        /\b(?:buat(?:kan)?|bikin(?:kan)?|tambah(?:kan)?)\b.{0,30}\b(?:dompet|wallet|rekening)\b/iu,
    },
    {
      actionType: 'delete_wallet',
      pattern:
        /\b(?:hapus|buang|delete|hilangkan|arsipkan)\b.{0,24}\b(?:dompet|wallet|rekening)\b/iu,
    },
    {
      actionType: 'restore_wallet',
      pattern:
        /\b(?:pulihkan|kembalikan|restore|aktifkan kembali)\b.{0,24}\b(?:dompet|wallet|rekening)\b/iu,
    },
    {
      actionType: 'rename_wallet',
      pattern:
        /\b(?:rename|ganti nama|ubah nama)\b.{0,24}\b(?:dompet|wallet|rekening)\b/iu,
    },
    {
      actionType: 'undo_transaction',
      pattern:
        /\b(?:undo|batalkan|hapus)\b.{0,24}\b(?:transaksi|pengeluaran|pemasukan)\b/iu,
    },
    {
      actionType: 'goal_contribution',
      pattern:
        /\b(?:setor|tabung|masukkan|tambah)\b.{0,35}\b(?:target|tabungan|dana darurat)\b/iu,
    },
    {
      actionType: 'goal_withdrawal',
      pattern:
        /\b(?:cairkan|tarik|ambil)\b.{0,35}\b(?:target|tabungan|dana darurat)\b/iu,
    },
  ]
  const match = rules.find((rule) => rule.pattern.test(text))
  return match
    ? {
        actionType: match.actionType,
        mutates: true,
      }
    : null
}

export function summarizeSemanticFrame(frame) {
  if (!frame) return null
  return {
    version: frame.version,
    intent: frame.intent,
    canonicalIntent: frame.canonicalIntent || frame.intent,
    legacyIntent: frame.legacyIntent || frame.intent,
    confidence: frame.confidence,
    dialogueAct: frame.dialogueAct,
    action: frame.action,
    slots: frame.slots,
    missingSlots: frame.missingSlots,
    references: frame.references,
    emotion: frame.emotion,
    safety: frame.safety,
    engine: frame.engine || null,
  }
}

function detectDialogueAct({ text, entities, intent }) {
  if (entities.confirmation) return 'confirmation'
  if (entities.cancellation) return 'cancellation'
  if (intent === 'correct_pending_action' ||
      /\b(?:koreksi|revisi|ubah|ganti|harusnya|seharusnya)\b/iu.test(text)) {
    return 'correction'
  }
  if (
    /\b(?:ajari|ajarkan|ingat|mulai sekarang|kalau aku bilang|kalau saya bilang|lupakan aturan)\b/iu.test(
      text
    )
  ) {
    return 'teaching'
  }
  if (intent === 'general_chat' && /^(?:halo|hai|hi|pagi|siang|sore|malam)\b/iu.test(text)) {
    return 'greeting'
  }
  if (entities.question) return 'question'
  if (intent === 'emotional_support') return 'emotional_disclosure'
  if (intent.startsWith('record_') || intent.startsWith('create_') ||
      intent.startsWith('update_') || intent === 'transfer_money') {
    return 'command'
  }
  return 'statement'
}

function summarizeEntities(entities) {
  return {
    amounts: (entities.amounts || []).map((amount) => ({
      value: amount.value,
      raw: amount.raw,
      confidence: amount.confidence,
    })),
    wallets: (entities.wallets || []).map((wallet) => ({
      id: wallet.id || null,
      name: wallet.name || null,
      source: wallet.source,
      confidence: wallet.confidence,
    })),
    categories: (entities.categories || []).map((category) => ({
      id: category.id || null,
      name: category.name || null,
      confidence: category.confidence,
    })),
    goals: (entities.goals || []).map((goal) => ({
      id: goal.id || null,
      name: goal.name || null,
      confidence: goal.confidence,
    })),
    dates: (entities.dates || []).map((date) => ({
      value: date.value,
      source: date.source,
      confidence: date.confidence,
    })),
    flags: {
      question: entities.question,
      hypothetical: entities.hypothetical,
      negated: entities.negated,
      thirdParty: entities.thirdParty,
    },
  }
}
