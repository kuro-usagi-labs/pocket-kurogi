import { isMutatingAssistantIntent } from './intentDefinitions'
import { isValidWalletBalance } from '../walletBalanceAdjustment'
import { isCompatibleCategoryType } from '../categoryCatalog'

const DEFAULT_TTL_MS = 15 * 60 * 1000
const TERMINAL_STATUSES = new Set(['confirmed', 'cancelled', 'expired', 'failed'])

export function createPendingAction({
  id = null,
  userId,
  intent,
  actionType,
  payload,
  sourceMessageId = null,
  now = new Date(),
  ttlMs = DEFAULT_TTL_MS,
} = {}) {
  if (!userId) throw new Error('userId wajib tersedia untuk pending action.')
  if (!intent || !isMutatingAssistantIntent(intent)) {
    throw new Error('Pending action hanya boleh dibuat untuk intent mutasi yang dikenal.')
  }
  if (!actionType) throw new Error('actionType wajib tersedia untuk pending action.')
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Payload pending action harus berupa object.')
  }

  const createdAt = new Date(now)
  const actionId = id || createActionId({
    userId,
    intent,
    payload,
    sourceMessageId,
    createdAt,
  })

  return {
    id: actionId,
    userId,
    intent,
    actionType,
    payload: structuredCloneSafe(payload),
    payloadHash: stableHash(stableStringify(payload)),
    idempotencyKey: actionId,
    sourceMessageId,
    status: 'pending',
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + ttlMs).toISOString(),
    confirmedAt: null,
    cancelledAt: null,
    failedAt: null,
    failureReason: null,
    result: null,
  }
}

export function confirmPendingAction(action, {
  userId,
  now = new Date(),
} = {}) {
  const validated = validatePendingTransition(action, userId, now)

  if (validated.status === 'confirmed') {
    return { action: validated, replayed: true }
  }

  const confirmedAt = new Date(now).toISOString()
  return {
    action: {
      ...validated,
      status: 'confirmed',
      confirmedAt,
      updatedAt: confirmedAt,
    },
    replayed: false,
  }
}

export function cancelPendingAction(action, {
  userId,
  now = new Date(),
} = {}) {
  const validated = validatePendingTransition(action, userId, now)
  if (validated.status === 'cancelled') return validated
  if (validated.status === 'confirmed') {
    throw new Error('Aksi yang sudah dikonfirmasi tidak dapat dibatalkan sebagai draft.')
  }

  const cancelledAt = new Date(now).toISOString()
  return {
    ...validated,
    status: 'cancelled',
    cancelledAt,
    updatedAt: cancelledAt,
  }
}

export function correctPendingAction(action, {
  userId,
  patch,
  now = new Date(),
} = {}) {
  const validated = validatePendingTransition(action, userId, now)
  if (validated.status !== 'pending') {
    throw new Error('Hanya pending action aktif yang dapat diubah.')
  }
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('Koreksi pending action harus berupa object.')
  }

  const payload = deepMerge(validated.payload, patch)
  const updatedAt = new Date(now).toISOString()
  return {
    ...validated,
    payload,
    payloadHash: stableHash(stableStringify(payload)),
    updatedAt,
  }
}

export function expirePendingAction(action, now = new Date()) {
  if (!action || action.status !== 'pending') return action
  if (new Date(action.expiresAt).getTime() > new Date(now).getTime()) return action
  const updatedAt = new Date(now).toISOString()
  return {
    ...action,
    status: 'expired',
    updatedAt,
  }
}

export function markPendingActionFailed(action, reason, now = new Date()) {
  if (!action || action.status !== 'confirmed') {
    throw new Error('Hanya aksi terkonfirmasi yang dapat ditandai gagal.')
  }
  const failedAt = new Date(now).toISOString()
  return {
    ...action,
    status: 'failed',
    failedAt,
    updatedAt: failedAt,
    failureReason: String(reason || 'Eksekusi gagal.'),
  }
}

export function attachPendingActionResult(action, result, now = new Date()) {
  if (!action || action.status !== 'confirmed') {
    throw new Error('Hasil hanya boleh dipasang pada aksi terkonfirmasi.')
  }
  return {
    ...action,
    result: structuredCloneSafe(result),
    updatedAt: new Date(now).toISOString(),
  }
}

export function isPendingActionActive(action, now = new Date()) {
  return Boolean(
    action &&
    action.status === 'pending' &&
    new Date(action.expiresAt).getTime() > new Date(now).getTime()
  )
}

export function buildCorrectedPendingPayload(action, {
  entities = {},
  text = '',
} = {}) {
  if (!action?.payload || action.status !== 'pending') {
    return {
      changed: false,
      payload: action?.payload || null,
      reason: 'Pending action aktif tidak ditemukan.',
    }
  }

  const payload = structuredCloneSafe(action.payload)
  const amount = entities.amounts?.length === 1
    ? Number(entities.amounts[0].value)
    : null
  const wallet = entities.wallets?.find((entry) => entry.id) || null
  const category = entities.categories?.find((entry) => entry.name) || null
  const normalizedText = String(text || '').toLowerCase()
  let changed = false

  if (action.actionType === 'record_transactions') {
    const items = Array.isArray(payload.items) ? payload.items : []
    const itemIndex = resolveCorrectionItemIndex(items, normalizedText)
    if (items.length > 1 && itemIndex < 0 && (amount || wallet || category)) {
      return {
        changed: false,
        payload,
        reason: 'Sebutkan item transaksi yang ingin diubah agar koreksi tidak mengenai item yang salah.',
      }
    }
    const targetIndexes = itemIndex >= 0
      ? [itemIndex]
      : items.length === 1
        ? [0]
        : []

    if (category && targetIndexes.some((index) => !isCompatibleCategoryType(
      category.category?.category_type || category.transactionType,
      items[index].transactionType
    ))) {
      return {
        changed: false,
        payload,
        reason: `Kategori ${category.name} tidak sesuai jenis transaksi ini. Pilih kategori yang sesuai untuk pemasukan atau pengeluaran tersebut.`,
      }
    }

    for (const index of targetIndexes) {
      if (amount) {
        items[index].amount = amount
        changed = true
      }
      if (wallet) {
        items[index].walletId = wallet.id
        items[index].wallet = wallet.name
        changed = true
      }
      if (category) {
        items[index].categoryId = category.id || null
        items[index].category = category.name
        changed = true
      }
    }
    payload.items = items
  } else if (action.actionType === 'set_wallet_balance') {
    const unsafe = entities.negated || entities.hypothetical || entities.question || entities.thirdParty ||
      (amount !== null && !isValidWalletBalance(amount)) ||
      entities.foreignCurrencies?.length || entities.amounts?.length > 1 ||
      (entities.wallets || []).some((entry) => entry.source === 'ambiguous') ||
      new Set((entities.wallets || []).filter((entry) => entry.id).map((entry) => entry.id)).size > 1 ||
      /\b(?:atau|jangan|bukan|tidak|kalau|andaikan)\b|(?:-|minus|negatif)\s*(?:rp\s*)?\d/iu.test(text)
    if (unsafe) {
      return { changed: false, payload, reason: 'Saldo belum diubah. Sebutkan satu dompet dan satu saldo akhir yang pasti, tanpa negasi atau pilihan alternatif.' }
    }
    const zero = /(?:^|\b(?:menjadi|jadi|ke|saldo|nominalnya)\s*)(?:rp\s*)?0(?:[.,]0+)?\s*$/iu.test(text)
    const nextBalance = zero ? 0 : amount
    if (nextBalance !== null && Number.isFinite(nextBalance) && nextBalance >= 0 && nextBalance <= 9999999999999.99 && !/(?:-|minus|negatif)\s*(?:rp\s*)?\d/iu.test(text)) {
      payload.targetBalance = nextBalance
      changed = true
    }
    if (wallet && wallet.wallet?.current_balance != null) {
      payload.walletId = wallet.id
      payload.walletName = wallet.name
      payload.expectedBalance = Number(wallet.wallet.current_balance)
      changed = true
    }
  } else if (action.actionType === 'transfer_money') {
    if (amount) {
      payload.amount = amount
      changed = true
    }
    if (entities.transferWallets?.source) {
      payload.sourceWalletId = entities.transferWallets.source.id
      payload.sourceWallet = entities.transferWallets.source.name
      changed = true
    }
    if (entities.transferWallets?.destination) {
      payload.destinationWalletId = entities.transferWallets.destination.id
      payload.destinationWallet = entities.transferWallets.destination.name
      changed = true
    }
  } else if (amount) {
    payload.amount = amount
    changed = true
  }

  return {
    changed,
    payload,
    reason: changed
      ? null
      : 'Sebutkan nilai baru secara langsung, misalnya "nominalnya 25rb" atau "pakai GoPay".',
  }
}

function validatePendingTransition(action, userId, now) {
  if (!action || typeof action !== 'object') throw new Error('Pending action tidak ditemukan.')
  if (!userId || action.userId !== userId) throw new Error('Pending action bukan milik sesi ini.')

  const current = expirePendingAction(action, now)
  if (current.status === 'expired') throw new Error('Pending action sudah kedaluwarsa.')
  if (TERMINAL_STATUSES.has(current.status) && current.status !== 'confirmed' && current.status !== 'cancelled') {
    throw new Error(`Pending action berstatus ${current.status} dan tidak bisa diproses lagi.`)
  }
  return current
}

function createActionId({ userId, intent, payload, sourceMessageId, createdAt }) {
  const seed = [
    userId,
    intent,
    sourceMessageId || '',
    createdAt.toISOString(),
    stableStringify(payload),
  ].join('|')
  return `pa_${stableHash(seed)}_${createdAt.getTime().toString(36)}`
}

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`
}

export function stableHash(value = '') {
  let hash = 2166136261
  for (const character of String(value)) {
    hash ^= character.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function deepMerge(base, patch) {
  if (Array.isArray(patch)) return structuredCloneSafe(patch)
  if (!patch || typeof patch !== 'object') return patch
  const output = { ...(base || {}) }
  for (const [key, value] of Object.entries(patch)) {
    output[key] =
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === 'object' &&
      !Array.isArray(output[key])
        ? deepMerge(output[key], value)
        : structuredCloneSafe(value)
  }
  return output
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

function resolveCorrectionItemIndex(items, text) {
  if (items.length === 1) return 0
  const matches = items
    .map((item, index) => ({
      index,
      description: String(
        item.description || item.desc || item.category || ''
      ).toLowerCase(),
    }))
    .filter((item) => item.description && text.includes(item.description))

  return matches.length === 1 ? matches[0].index : -1
}
