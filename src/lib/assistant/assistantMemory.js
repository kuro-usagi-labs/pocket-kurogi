const SUPPORTED_MEMORY_KEYS = new Set([
  'preferred_wallet',
  'preferred_communication_style',
  'salary_date',
  'common_merchant_category',
  'financial_priority',
  'saving_goal_preference',
  'frequent_transaction_description',
])

export function createAssistantMemory({
  key,
  value,
  confidence,
  source,
  userId = null,
  now = new Date(),
} = {}) {
  if (!SUPPORTED_MEMORY_KEYS.has(key)) {
    throw new Error(`Jenis memory tidak didukung: ${key}`)
  }
  if (value === null || value === undefined || String(value).trim() === '') {
    throw new Error('Nilai memory tidak boleh kosong.')
  }
  if (!['explicit', 'repeated', 'correction'].includes(source)) {
    throw new Error('Sumber memory harus explicit, repeated, atau correction.')
  }

  const normalizedConfidence = Math.min(Math.max(Number(confidence || 0), 0), 1)
  const timestamp = new Date(now).toISOString()
  return {
    userId,
    key,
    value,
    confidence: normalizedConfidence,
    source,
    lastUsedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function upsertAssistantMemory(memory = [], candidate, now = new Date()) {
  const existingIndex = memory.findIndex((entry) =>
    entry.key === candidate.key &&
    entry.userId === candidate.userId
  )
  const next = [...memory]

  if (existingIndex < 0) {
    next.push({ ...candidate, updatedAt: new Date(now).toISOString() })
    return next
  }

  const existing = next[existingIndex]
  const repeated = String(existing.value) === String(candidate.value)
  next[existingIndex] = {
    ...existing,
    value: candidate.value,
    confidence: repeated
      ? Math.min(Math.max(existing.confidence, candidate.confidence) + 0.08, 1)
      : candidate.source === 'explicit' || candidate.source === 'correction'
        ? candidate.confidence
        : Math.max(candidate.confidence - 0.12, 0),
    source: candidate.source,
    updatedAt: new Date(now).toISOString(),
  }
  return next
}

export function markMemoryUsed(memory = [], key, now = new Date()) {
  return memory.map((entry) =>
    entry.key === key
      ? { ...entry, lastUsedAt: new Date(now).toISOString() }
      : entry
  )
}

export function getUsableMemory(memory = [], key, minimumConfidence = 0.75) {
  return memory
    .filter((entry) => entry.key === key && Number(entry.confidence || 0) >= minimumConfidence)
    .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))[0] || null
}

export function inferMemoryCandidates({
  text = '',
  resolvedWallet = null,
  resolvedCategory = null,
  correction = false,
  now = new Date(),
  userId = null,
} = {}) {
  const normalized = String(text || '').toLowerCase()
  const candidates = []

  if (
    resolvedWallet &&
    /\b(?:biasanya|selalu|default|utama|lebih sering|mulai sekarang)\b/iu.test(normalized)
  ) {
    candidates.push(createAssistantMemory({
      key: 'preferred_wallet',
      value: resolvedWallet.id || resolvedWallet.name,
      confidence: 0.92,
      source: correction ? 'correction' : 'explicit',
      now,
      userId,
    }))
  }

  if (/\b(?:singkat|ringkas|to the point)\b/iu.test(normalized)) {
    candidates.push(createAssistantMemory({
      key: 'preferred_communication_style',
      value: 'concise',
      confidence: 0.96,
      source: 'explicit',
      now,
      userId,
    }))
  } else if (/\b(?:jelaskan detail|lebih detail|lengkap)\b/iu.test(normalized)) {
    candidates.push(createAssistantMemory({
      key: 'preferred_communication_style',
      value: 'detailed',
      confidence: 0.96,
      source: 'explicit',
      now,
      userId,
    }))
  }

  const salaryDate = normalized.match(/\b(?:gajian|gaji masuk)\s+(?:setiap\s+)?tanggal\s+(\d{1,2})\b/iu)
  if (salaryDate) {
    candidates.push(createAssistantMemory({
      key: 'salary_date',
      value: Number(salaryDate[1]),
      confidence: 0.98,
      source: 'explicit',
      now,
      userId,
    }))
  }

  if (
    resolvedCategory &&
    /\b(?:biasanya|selalu|anggap|masukkan)\b/iu.test(normalized)
  ) {
    candidates.push(createAssistantMemory({
      key: 'common_merchant_category',
      value: resolvedCategory.id || resolvedCategory.name,
      confidence: 0.86,
      source: correction ? 'correction' : 'explicit',
      now,
      userId,
    }))
  }

  return candidates
}
