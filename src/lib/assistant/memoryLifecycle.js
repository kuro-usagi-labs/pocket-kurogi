const SUPPORTED_MEMORY_KEY_SET = new Set([
  'preferred_wallet',
  'preferred_communication_style',
  'salary_date',
  'common_merchant_category',
  'financial_priority',
  'saving_goal_preference',
  'frequent_transaction_description',
])

const SUPPORTED_SOURCE_SET = new Set([
  'explicit',
  'repeated',
  'correction',
])

const SUPPORTED_EVIDENCE_KIND_SET = new Set([
  'observation',
  'explicit_instruction',
  'confirmation',
  'correction',
])

const TERMINAL_STATUS_SET = new Set([
  'corrected',
  'forgotten',
  'deprecated',
])

const UNSAFE_VALUE_RULES = [
  {
    code: 'system_instruction_override',
    pattern: /\b(?:abaikan|ignore|lupakan|forget)\b.{0,48}\b(?:instruksi|instruction|sistem|system|prompt|aturan\s+utama)\b/iu,
  },
  {
    code: 'confirmation_bypass',
    pattern: /\b(?:tanpa|without|lewati|bypass|nonaktifkan|disable|matikan|skip)\b.{0,40}\b(?:konfirmasi|confirmation|validasi|validation|persetujuan|approval)\b/iu,
  },
  {
    code: 'safety_bypass',
    pattern: /\b(?:lewati|bypass|nonaktifkan|disable|matikan|ignore)\b.{0,40}\b(?:safety|keamanan|guardrail|rls|otorisasi|authorization|auth)\b/iu,
  },
  {
    code: 'privilege_escalation',
    pattern: /\b(?:jadikan|anggap|gunakan|set|ubah)\b.{0,40}\b(?:admin|owner|service[\s_-]?role|superuser)\b/iu,
  },
  {
    code: 'secret_material',
    pattern: /\b(?:api[\s_-]?key|password|kata\s+sandi|secret|jwt|access[\s_-]?token|refresh[\s_-]?token|private[\s_-]?key)\b/iu,
  },
  {
    code: 'automatic_execution_override',
    pattern: /\b(?:selalu|langsung|otomatis|always|automatically)\b.{0,40}\b(?:jalankan|eksekusi|execute|catat)\b.{0,40}\b(?:tanpa\s+(?:bertanya|konfirmasi)|without\s+(?:asking|confirmation))\b/iu,
  },
]

export const MEMORY_LIFECYCLE_STATUS = Object.freeze({
  OBSERVED: 'observed',
  PROPOSED: 'proposed',
  CONFIRMED: 'confirmed',
  ACTIVE: 'active',
  CORRECTED: 'corrected',
  FORGOTTEN: 'forgotten',
  DEPRECATED: 'deprecated',
})

export const SUPPORTED_MEMORY_KEYS = Object.freeze([
  ...SUPPORTED_MEMORY_KEY_SET,
])

export const MEMORY_PROMOTION_RULES = Object.freeze({
  explicit: Object.freeze({
    minimumEvidence: 1,
    minimumConfidence: 0.85,
  }),
  repeated: Object.freeze({
    minimumEvidence: 3,
    minimumConfidence: 0.78,
  }),
  correction: Object.freeze({
    minimumEvidence: 1,
    minimumConfidence: 0.9,
  }),
})

export class MemoryLifecycleError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'MemoryLifecycleError'
    this.code = code
  }
}

export function assessMemorySafety({ key, value } = {}) {
  const reasons = []

  if (!SUPPORTED_MEMORY_KEY_SET.has(key)) {
    reasons.push('unsupported_memory_key')
  }

  const serialized = serializeValue(value)
  if (serialized === null || serialized === '' || serialized === 'null') {
    reasons.push('empty_memory_value')
  } else if (new TextEncoder().encode(serialized).length > 4096) {
    reasons.push('memory_value_too_large')
  }

  if (key === 'salary_date' && (
    !Number.isInteger(Number(value)) ||
    Number(value) < 1 ||
    Number(value) > 31
  )) {
    reasons.push('invalid_salary_date')
  }

  const normalizedValue = normalizeSafetyText(serialized || '')
  for (const rule of UNSAFE_VALUE_RULES) {
    if (rule.pattern.test(normalizedValue)) {
      reasons.push(rule.code)
    }
  }
  if (collectObjectKeys(value).some((field) =>
    /^(?:system_?prompt|developer_?instruction|disable_?(?:confirmation|validation|safety)|bypass|auth|authorization|permission|role|rls)$/iu.test(field)
  )) {
    reasons.push('unsafe_memory_field')
  }

  return {
    safe: reasons.length === 0,
    reasons: [...new Set(reasons)],
  }
}

export function createMemoryObservation({
  id,
  accountId,
  key,
  value,
  confidence,
  source,
  evidence,
  now = new Date(),
} = {}) {
  assertAccountId(accountId)
  assertSupportedSource(source)

  const safety = assessMemorySafety({ key, value })
  if (!safety.safe) {
    throw new MemoryLifecycleError(
      'UNSAFE_MEMORY',
      `Memory ditolak: ${safety.reasons.join(', ')}`
    )
  }

  const timestamp = toIsoTimestamp(now)
  const normalizedValue = cloneValue(value)
  const normalizedEvidence = normalizeEvidence(evidence, {
    defaultConfidence: confidence,
    defaultSource: source,
    now: timestamp,
  })
  assertEvidenceMatchesSource(normalizedEvidence, source)
  assertEvidenceValueConsistency(normalizedEvidence, normalizedValue)

  const memoryId = normalizeOptionalId(id) || buildStableId({
    accountId,
    key,
    timestamp,
    evidenceId: normalizedEvidence.id,
  })

  return {
    id: memoryId,
    accountId,
    key,
    value: normalizedValue,
    status: MEMORY_LIFECYCLE_STATUS.OBSERVED,
    confidence: normalizedEvidence.confidence,
    source,
    evidence: [normalizedEvidence],
    revision: 1,
    supersedesId: null,
    replacementId: null,
    confirmedAt: null,
    activatedAt: null,
    correctedAt: null,
    forgottenAt: null,
    deprecatedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    history: [{
      from: null,
      to: MEMORY_LIFECYCLE_STATUS.OBSERVED,
      at: timestamp,
      reason: 'memory_observed',
      evidenceId: normalizedEvidence.id,
    }],
  }
}

export function recordMemoryEvidence(memory, {
  accountId,
  evidence,
  now = new Date(),
} = {}) {
  assertMemoryShape(memory)
  assertMemoryScope(memory, accountId)
  assertStatus(memory, [
    MEMORY_LIFECYCLE_STATUS.OBSERVED,
    MEMORY_LIFECYCLE_STATUS.PROPOSED,
  ])

  const normalizedEvidence = normalizeEvidence(evidence, {
    defaultConfidence: memory.confidence,
    defaultSource: memory.source,
    now: toIsoTimestamp(now),
  })
  assertEvidenceMatchesSource(normalizedEvidence, normalizedEvidence.source)

  if (memory.evidence.some((item) => item.id === normalizedEvidence.id)) {
    return cloneMemory(memory)
  }

  if (
    normalizedEvidence.value !== undefined &&
    canonicalSerialize(normalizedEvidence.value) !== canonicalSerialize(memory.value)
  ) {
    throw new MemoryLifecycleError(
      'CONFLICTING_EVIDENCE',
      'Bukti dengan nilai berbeda harus diproses sebagai koreksi.'
    )
  }

  const evidenceList = [
    ...memory.evidence.map(cloneValue),
    normalizedEvidence,
  ]
  const source = resolveStrongestSource(evidenceList)
  const timestamp = toIsoTimestamp(now)

  return {
    ...cloneMemory(memory),
    confidence: calculateEvidenceConfidence(evidenceList),
    source,
    evidence: evidenceList,
    revision: memory.revision + 1,
    updatedAt: timestamp,
  }
}

export function evaluateMemoryPromotion(memory) {
  assertMemoryShape(memory)

  if (memory.status !== MEMORY_LIFECYCLE_STATUS.OBSERVED) {
    return {
      eligible: false,
      nextStatus: null,
      reasons: ['memory_not_observed'],
    }
  }

  const safety = assessMemorySafety(memory)
  if (!safety.safe) {
    return {
      eligible: false,
      nextStatus: null,
      reasons: safety.reasons,
    }
  }

  const matchingEvidence = memory.evidence.filter((item) =>
    item.source === memory.source
  )
  const rules = MEMORY_PROMOTION_RULES[memory.source]
  const distinctEvidenceCount = new Set(
    matchingEvidence.map((item) => item.id)
  ).size
  const confidence = calculateEvidenceConfidence(matchingEvidence)
  const reasons = []

  if (distinctEvidenceCount < rules.minimumEvidence) {
    reasons.push('insufficient_distinct_evidence')
  }
  if (confidence < rules.minimumConfidence) {
    reasons.push('confidence_below_threshold')
  }

  return {
    eligible: reasons.length === 0,
    nextStatus: reasons.length === 0
      ? MEMORY_LIFECYCLE_STATUS.PROPOSED
      : null,
    reasons,
    evidenceCount: distinctEvidenceCount,
    confidence,
  }
}

export function proposeMemory(memory, {
  accountId,
  now = new Date(),
} = {}) {
  assertMemoryScope(memory, accountId)
  const evaluation = evaluateMemoryPromotion(memory)
  if (!evaluation.eligible) {
    throw new MemoryLifecycleError(
      'PROMOTION_NOT_ALLOWED',
      `Memory belum layak diusulkan: ${evaluation.reasons.join(', ')}`
    )
  }

  return transitionMemory(memory, {
    to: MEMORY_LIFECYCLE_STATUS.PROPOSED,
    at: now,
    reason: 'promotion_rules_satisfied',
  })
}

export function confirmMemory(memory, {
  accountId,
  evidence,
  now = new Date(),
} = {}) {
  assertMemoryShape(memory)
  assertMemoryScope(memory, accountId)
  assertStatus(memory, [MEMORY_LIFECYCLE_STATUS.PROPOSED])

  const timestamp = toIsoTimestamp(now)
  const confirmation = normalizeEvidence(evidence, {
    defaultConfidence: 1,
    defaultSource: 'explicit',
    now: timestamp,
  })

  if (
    confirmation.kind !== 'confirmation' ||
    confirmation.source !== 'explicit' ||
    confirmation.affirmed !== true
  ) {
    throw new MemoryLifecycleError(
      'EXPLICIT_CONFIRMATION_REQUIRED',
      'Aktivasi memory memerlukan konfirmasi eksplisit dari pengguna.'
    )
  }
  assertEvidenceValueConsistency(confirmation, memory.value)

  const safety = assessMemorySafety(memory)
  if (!safety.safe) {
    throw new MemoryLifecycleError(
      'UNSAFE_MEMORY',
      `Memory ditolak: ${safety.reasons.join(', ')}`
    )
  }

  const withEvidence = {
    ...cloneMemory(memory),
    evidence: [
      ...memory.evidence.map(cloneValue),
      confirmation,
    ],
    confidence: Math.max(memory.confidence, confirmation.confidence),
    revision: memory.revision + 1,
    updatedAt: timestamp,
  }

  return transitionMemory(withEvidence, {
    to: MEMORY_LIFECYCLE_STATUS.CONFIRMED,
    at: timestamp,
    reason: 'user_confirmed',
    evidenceId: confirmation.id,
    extra: { confirmedAt: timestamp },
  })
}

export function activateMemory(memory, {
  accountId,
  now = new Date(),
} = {}) {
  assertMemoryShape(memory)
  assertMemoryScope(memory, accountId)
  assertStatus(memory, [MEMORY_LIFECYCLE_STATUS.CONFIRMED])

  const safety = assessMemorySafety(memory)
  if (!safety.safe) {
    throw new MemoryLifecycleError(
      'UNSAFE_MEMORY',
      `Memory ditolak: ${safety.reasons.join(', ')}`
    )
  }

  const timestamp = toIsoTimestamp(now)
  return transitionMemory(memory, {
    to: MEMORY_LIFECYCLE_STATUS.ACTIVE,
    at: timestamp,
    reason: 'confirmed_memory_activated',
    extra: { activatedAt: timestamp },
  })
}

export function correctMemory(memory, {
  accountId,
  replacementId,
  value,
  confidence = 1,
  evidence,
  now = new Date(),
} = {}) {
  assertMemoryShape(memory)
  assertMemoryScope(memory, accountId)
  assertStatus(memory, [
    MEMORY_LIFECYCLE_STATUS.PROPOSED,
    MEMORY_LIFECYCLE_STATUS.CONFIRMED,
    MEMORY_LIFECYCLE_STATUS.ACTIVE,
  ])

  const timestamp = toIsoTimestamp(now)
  const correctionEvidence = normalizeEvidence(evidence, {
    defaultConfidence: confidence,
    defaultSource: 'correction',
    now: timestamp,
  })

  if (correctionEvidence.kind !== 'correction' || correctionEvidence.source !== 'correction') {
    throw new MemoryLifecycleError(
      'CORRECTION_EVIDENCE_REQUIRED',
      'Perubahan memory memerlukan bukti koreksi eksplisit.'
    )
  }

  const replacement = createMemoryObservation({
    id: replacementId,
    accountId,
    key: memory.key,
    value,
    confidence,
    source: 'correction',
    evidence: correctionEvidence,
    now: timestamp,
  })

  const corrected = transitionMemory(memory, {
    to: MEMORY_LIFECYCLE_STATUS.CORRECTED,
    at: timestamp,
    reason: 'superseded_by_user_correction',
    evidenceId: correctionEvidence.id,
    extra: {
      correctedAt: timestamp,
      replacementId: replacement.id,
    },
  })

  return {
    corrected,
    replacement: {
      ...replacement,
      supersedesId: memory.id,
    },
  }
}

export function forgetMemory(memory, {
  accountId,
  now = new Date(),
} = {}) {
  assertMemoryShape(memory)
  assertMemoryScope(memory, accountId)
  assertNotTerminal(memory)

  const timestamp = toIsoTimestamp(now)
  const forgotten = transitionMemory(memory, {
    to: MEMORY_LIFECYCLE_STATUS.FORGOTTEN,
    at: timestamp,
    reason: 'user_requested_forgetting',
    extra: {
      forgottenAt: timestamp,
      value: null,
      evidence: [],
      confidence: 0,
    },
  })

  return forgotten
}

export function deprecateMemory(memory, {
  accountId,
  reason = 'memory_no_longer_applicable',
  now = new Date(),
} = {}) {
  assertMemoryShape(memory)
  assertMemoryScope(memory, accountId)
  assertNotTerminal(memory)

  const timestamp = toIsoTimestamp(now)
  return transitionMemory(memory, {
    to: MEMORY_LIFECYCLE_STATUS.DEPRECATED,
    at: timestamp,
    reason: normalizeReason(reason),
    extra: { deprecatedAt: timestamp },
  })
}

export function getActiveMemories(memories = [], {
  accountId,
  key = null,
  minimumConfidence = 0.75,
} = {}) {
  assertAccountId(accountId)

  return memories
    .filter((memory) => (
      memory?.accountId === accountId &&
      memory?.status === MEMORY_LIFECYCLE_STATUS.ACTIVE &&
      (!key || memory.key === key) &&
      Number(memory.confidence || 0) >= minimumConfidence &&
      assessMemorySafety(memory).safe
    ))
    .sort((left, right) =>
      new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0)
    )
    .map(cloneMemory)
}

export function toAssistantMemory(memory, { accountId } = {}) {
  assertMemoryShape(memory)
  assertMemoryScope(memory, accountId)
  assertStatus(memory, [MEMORY_LIFECYCLE_STATUS.ACTIVE])

  const safety = assessMemorySafety(memory)
  if (!safety.safe) {
    throw new MemoryLifecycleError(
      'UNSAFE_MEMORY',
      `Memory ditolak: ${safety.reasons.join(', ')}`
    )
  }

  return {
    id: memory.id,
    userId: memory.accountId,
    key: memory.key,
    value: cloneValue(memory.value),
    confidence: memory.confidence,
    source: memory.source,
    lastUsedAt: null,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
  }
}

export function proposeMemoryCandidate({
  candidate,
  accountId,
  instructionEvidence,
  now = new Date(),
} = {}) {
  if (!candidate || typeof candidate !== 'object') {
    throw new MemoryLifecycleError(
      'INVALID_MEMORY_CANDIDATE',
      'Kandidat memory tidak valid.'
    )
  }
  assertAccountId(accountId)
  if (candidate.userId && candidate.userId !== accountId) {
    throw new MemoryLifecycleError(
      'ACCOUNT_SCOPE_MISMATCH',
      'Kandidat memory tidak berada dalam scope akun ini.'
    )
  }
  if (!['explicit', 'correction'].includes(candidate.source)) {
    throw new MemoryLifecycleError(
      'EXPLICIT_CONFIRMATION_REQUIRED',
      'Kandidat hasil inferensi berulang tidak boleh langsung diaktifkan.'
    )
  }

  const observed = createMemoryObservation({
    accountId,
    key: candidate.key,
    value: candidate.value,
    confidence: candidate.confidence,
    source: candidate.source,
    evidence: instructionEvidence,
    now,
  })

  return proposeMemory(observed, { accountId, now })
}

export function activateProposedMemoryCandidate({
  proposal,
  accountId,
  confirmationEvidence,
  now = new Date(),
} = {}) {
  const confirmed = confirmMemory(proposal, {
    accountId,
    evidence: confirmationEvidence,
    now,
  })
  const active = activateMemory(confirmed, { accountId, now })

  return {
    lifecycle: active,
    memory: toAssistantMemory(active, { accountId }),
  }
}

function transitionMemory(memory, {
  to,
  at,
  reason,
  evidenceId = null,
  extra = {},
}) {
  const timestamp = toIsoTimestamp(at)

  return {
    ...cloneMemory(memory),
    ...cloneValue(extra),
    status: to,
    revision: memory.revision + 1,
    updatedAt: timestamp,
    history: [
      ...memory.history.map(cloneValue),
      {
        from: memory.status,
        to,
        at: timestamp,
        reason,
        evidenceId,
      },
    ],
  }
}

function normalizeEvidence(evidence, {
  defaultConfidence,
  defaultSource,
  now,
}) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new MemoryLifecycleError(
      'INVALID_EVIDENCE',
      'Bukti memory harus berupa object.'
    )
  }

  const id = normalizeOptionalId(evidence.id)
  if (!id) {
    throw new MemoryLifecycleError(
      'INVALID_EVIDENCE',
      'Bukti memory wajib memiliki id yang stabil.'
    )
  }

  const source = evidence.source || defaultSource
  assertSupportedSource(source)

  const kind = evidence.kind || 'observation'
  if (!SUPPORTED_EVIDENCE_KIND_SET.has(kind)) {
    throw new MemoryLifecycleError(
      'INVALID_EVIDENCE_KIND',
      `Jenis bukti tidak didukung: ${kind}`
    )
  }

  const confidence = normalizeConfidence(
    evidence.confidence ?? defaultConfidence
  )

  return {
    id,
    kind,
    source,
    confidence,
    reference: normalizeOptionalId(evidence.reference),
    observedAt: toIsoTimestamp(evidence.observedAt || now),
    ...(evidence.affirmed === true ? { affirmed: true } : {}),
    ...(evidence.value !== undefined
      ? { value: cloneValue(evidence.value) }
      : {}),
  }
}

function assertEvidenceMatchesSource(evidence, source) {
  if (evidence.source !== source) {
    throw new MemoryLifecycleError(
      'EVIDENCE_SOURCE_MISMATCH',
      'Sumber bukti harus sama dengan sumber memory.'
    )
  }

  const requiredKind = {
    correction: 'correction',
    explicit: 'explicit_instruction',
    repeated: 'observation',
  }[source]

  if (requiredKind && evidence.kind !== requiredKind) {
    throw new MemoryLifecycleError(
      'EVIDENCE_KIND_MISMATCH',
      `Sumber ${source} memerlukan bukti ${requiredKind}.`
    )
  }
}

function assertEvidenceValueConsistency(evidence, value) {
  if (
    evidence.value !== undefined &&
    canonicalSerialize(evidence.value) !== canonicalSerialize(value)
  ) {
    throw new MemoryLifecycleError(
      'CONFLICTING_EVIDENCE',
      'Nilai bukti tidak sesuai dengan nilai memory.'
    )
  }
}

function calculateEvidenceConfidence(evidence = []) {
  if (evidence.length === 0) return 0

  const total = evidence.reduce(
    (sum, item) => sum + Number(item.confidence || 0),
    0
  )
  return Number((total / evidence.length).toFixed(3))
}

function resolveStrongestSource(evidence) {
  if (evidence.some((item) => item.source === 'correction')) return 'correction'
  if (evidence.some((item) => item.source === 'explicit')) return 'explicit'
  return 'repeated'
}

function assertMemoryShape(memory) {
  if (!memory || typeof memory !== 'object') {
    throw new MemoryLifecycleError(
      'INVALID_MEMORY',
      'Memory lifecycle tidak valid.'
    )
  }
  assertAccountId(memory.accountId)
  if (!SUPPORTED_MEMORY_KEY_SET.has(memory.key)) {
    throw new MemoryLifecycleError(
      'INVALID_MEMORY',
      'Memory lifecycle memiliki key yang tidak didukung.'
    )
  }
  if (!Object.values(MEMORY_LIFECYCLE_STATUS).includes(memory.status)) {
    throw new MemoryLifecycleError(
      'INVALID_MEMORY',
      'Status memory lifecycle tidak valid.'
    )
  }
}

function assertMemoryScope(memory, accountId) {
  assertAccountId(accountId)
  if (memory.accountId !== accountId) {
    throw new MemoryLifecycleError(
      'ACCOUNT_SCOPE_MISMATCH',
      'Memory tidak berada dalam scope akun ini.'
    )
  }
}

function assertStatus(memory, expectedStatuses) {
  if (!expectedStatuses.includes(memory.status)) {
    throw new MemoryLifecycleError(
      'INVALID_STATUS_TRANSITION',
      `Memory berstatus ${memory.status} tidak dapat menjalankan transisi ini.`
    )
  }
}

function assertNotTerminal(memory) {
  if (TERMINAL_STATUS_SET.has(memory.status)) {
    throw new MemoryLifecycleError(
      'TERMINAL_MEMORY',
      `Memory berstatus ${memory.status} tidak dapat diubah lagi.`
    )
  }
}

function assertAccountId(accountId) {
  if (typeof accountId !== 'string' || !accountId.trim()) {
    throw new MemoryLifecycleError(
      'ACCOUNT_ID_REQUIRED',
      'Lifecycle memory wajib memiliki accountId.'
    )
  }
}

function assertSupportedSource(source) {
  if (!SUPPORTED_SOURCE_SET.has(source)) {
    throw new MemoryLifecycleError(
      'UNSUPPORTED_SOURCE',
      `Sumber memory tidak didukung: ${source}`
    )
  }
}

function normalizeConfidence(value) {
  const confidence = Number(value)
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new MemoryLifecycleError(
      'INVALID_CONFIDENCE',
      'Confidence memory harus berada di antara 0 dan 1.'
    )
  }
  return confidence
}

function normalizeOptionalId(value) {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  return normalized || null
}

function normalizeReason(reason) {
  const normalized = String(reason || '').trim()
  return normalized || 'memory_no_longer_applicable'
}

function normalizeSafetyText(value) {
  return String(value)
    .normalize('NFKC')
    .toLocaleLowerCase('id-ID')
    .replace(/[^\p{L}\p{N}_-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function serializeValue(value) {
  if (typeof value === 'string') return value.trim()
  if (value === undefined) return null

  try {
    return canonicalSerialize(value)
  } catch {
    return null
  }
}

function canonicalSerialize(value) {
  return JSON.stringify(canonicalize(value))
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => ({
        ...result,
        [key]: canonicalize(value[key]),
      }), {})
  }
  return value
}

function collectObjectKeys(value, result = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectObjectKeys(item, result)
    return result
  }
  if (!value || typeof value !== 'object') return result

  for (const [key, child] of Object.entries(value)) {
    result.push(String(key).replace(/[^\p{L}\p{N}_]+/gu, '').toLowerCase())
    collectObjectKeys(child, result)
  }
  return result
}

function cloneValue(value) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

function cloneMemory(memory) {
  return cloneValue(memory)
}

function toIsoTimestamp(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new MemoryLifecycleError(
      'INVALID_TIMESTAMP',
      'Timestamp memory tidak valid.'
    )
  }
  return date.toISOString()
}

function buildStableId({ accountId, key, timestamp, evidenceId }) {
  const input = `${accountId}:${key}:${timestamp}:${evidenceId}`
  let hash = 2166136261

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `memory_${(hash >>> 0).toString(36)}`
}
