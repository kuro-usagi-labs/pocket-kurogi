import { getIntentDefinition } from './intentDefinitions'

export function resolveIntentSlots({
  intent,
  entities = {},
  dialogueState = null,
  text = '',
} = {}) {
  const inherited = dialogueState?.activeIntent === intent
    ? dialogueState.collectedSlots || {}
    : {}
  const derived = deriveSlots(intent, entities, text)
  const contextualDerived =
    dialogueState?.activeIntent === intent && dialogueState.missingSlots?.length
      ? Object.fromEntries(
          Object.entries(derived).filter(([key]) =>
            dialogueState.missingSlots.includes(key) ||
            key === 'transactionType'
          )
        )
      : derived
  const slots = {
    ...inherited,
    ...contextualDerived,
  }
  const definition = getIntentDefinition(intent)
  const missingSlots = definition.required.filter((slot) => {
    if (
      intent === 'record_multiple_transactions' &&
      slot === 'wallet' &&
      Array.isArray(slots.items) &&
      slots.items.length > 0 &&
      slots.items.every((item) => item.walletId)
    ) {
      return false
    }
    return !hasSlotValue(slots[slot])
  })

  return {
    intent,
    slots,
    requiredSlots: definition.required,
    optionalSlots: definition.optional,
    missingSlots,
    complete: missingSlots.length === 0,
  }
}

function deriveSlots(intent, entities, text) {
  const amount = entities.amounts?.[0]?.value || null
  const wallet = entities.wallets?.[0]?.id
    ? {
        id: entities.wallets[0].id,
        name: entities.wallets[0].name,
      }
    : null
  const category = entities.categories?.[0]?.name
    ? {
        id: entities.categories[0].id,
        name: entities.categories[0].name,
      }
    : null
  const goal = entities.goals?.[0]?.id
    ? {
        id: entities.goals[0].id,
        name: entities.goals[0].name,
      }
    : null
  const occurredAt = entities.dates?.[0]?.value || null
  const description = deriveDescription(text, entities)
  const transactionType =
    intent === 'record_income'
      ? 'income'
      : intent === 'record_expense'
        ? 'expense'
        : entities.transactionTypes?.[0]?.value || null

  if (intent === 'transfer_money') {
    return compactObject({
      amount,
      sourceWallet: toWalletSlot(entities.transferWallets?.source),
      destinationWallet: toWalletSlot(entities.transferWallets?.destination),
      occurredAt,
    })
  }

  if (intent === 'calculate_change') {
    return compactObject({
      tenderedAmount: entities.amounts?.[0]?.value || null,
      changeAmount: entities.amounts?.[1]?.value || null,
      description,
      wallet,
    })
  }

  if (intent === 'record_multiple_transactions') {
    return compactObject({
      items: deriveMultipleItems(entities, text),
      wallet,
      occurredAt,
    })
  }

  if (intent === 'create_budget' || intent === 'update_budget') {
    return compactObject({ amount, category, period: 'monthly' })
  }

  if (intent === 'create_saving_goal') {
    return compactObject({
      amount,
      description: deriveSavingGoalDescription(text, entities),
      deadline: occurredAt,
      sourceWallet: wallet,
    })
  }

  if (intent === 'update_saving_goal') {
    return compactObject({
      goal,
      amount,
      deadline: occurredAt,
    })
  }

  if (intent === 'query_saving_goal') {
    return compactObject({ goal })
  }

  if (intent === 'query_wallet' || intent === 'select_wallet') {
    return compactObject({ wallet, occurredAt })
  }

  if (intent.startsWith('record_')) {
    return compactObject({
      amount,
      description,
      wallet,
      category,
      merchant: entities.merchants?.[0]?.name || null,
      occurredAt,
      transactionType,
    })
  }

  return compactObject({
    wallet,
    category,
    goal,
    occurredAt,
  })
}

function deriveDescription(text, entities) {
  const merchant = entities.merchants?.[0]?.name
  const walletNames = (entities.wallets || [])
    .map((wallet) => wallet.name)
    .filter(Boolean)
  if (
    merchant &&
    !isWalletLikeDescription(merchant, walletNames)
  ) {
    return merchant
  }

  let cleaned = String(text || '')
    .replace(/(?:rp\s*)?\d+(?:[.,]\d+)?\s*(?:ribu|rb|k|juta|jt|miliar)?/giu, ' ')
    .replace(/\b(?:tolong|mohon|catat|masukan|masukkan|simpan|rekam|input|tambahkan|tambah|tadi|hari ini|kemarin|pakai|pake|dari|ke|via|pada|untuk|sebagai|dengan|catatan|dompet|wallet|rekening|pemasukan|pendapatan|pengeluaran|income|expense|masuk|keluar|cash|tunai|kontan|uang fisik|uang kontan)\b/giu, ' ')

  for (const walletName of walletNames) {
    cleaned = cleaned.replace(
      new RegExp(`\\b${escapeRegExp(walletName)}\\b`, 'giu'),
      ' '
    )
  }

  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.;:!?-]+|[\s,.;:!?-]+$/gu, '')
    .trim()

  if (cleaned) return toSentenceCase(cleaned)

  const category = entities.categories?.[0]?.name
  return category && category.toLowerCase() !== 'lainnya'
    ? category
    : null
}

function isWalletLikeDescription(value, walletNames) {
  const normalized = String(value || '').trim().toLowerCase()
  return (
    /^(?:cash|tunai|kontan|uang fisik|uang kontan)$/iu.test(normalized) ||
    walletNames.some((name) =>
      String(name || '').trim().toLowerCase() === normalized
    )
  )
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toSentenceCase(value) {
  const text = String(value || '').trim()
  return text
    ? `${text.charAt(0).toLocaleUpperCase('id-ID')}${text.slice(1)}`
    : null
}

function deriveSavingGoalDescription(text, entities) {
  const cleaned = String(text || '')
    .replace(/(?:rp\s*)?\d+(?:[.,]\d+)?\s*(?:rupiah|ribu|rb|k|juta|jt|miliar)?/giu, ' ')
    .replace(/\b(?:tolong|mohon|buat|bikin|tambahkan|tambah|pasang|target|goal|tabungan|menabung|nabung|sebesar|senilai|dengan)\b/giu, ' ')
    .replace(/\b(?:hari ini|kemarin|besok|tanggal)\b/giu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
  return cleaned || deriveDescription(text, entities)
}

function deriveMultipleItems(entities, text) {
  const amounts = entities.amounts || []
  if (amounts.length < 2) return []

  return amounts.map((amount, index) => {
    const itemWallet = resolveItemWallet(
      entities.walletMentions || [],
      amounts,
      amount,
      index
    )
    return {
      clientItemId: `item-${index + 1}`,
      amount: amount.value,
      transactionType: entities.transactionTypes?.[0]?.value || 'expense',
      description: deriveItemDescription(text, amount, index),
      category: null,
      walletId: itemWallet?.id || null,
      wallet: itemWallet?.name || null,
    }
  })
}

function resolveItemWallet(mentions, amounts, amount, index) {
  if (mentions.length < 2) return null
  const nextAmountStart = amounts[index + 1]?.start ?? Number.POSITIVE_INFINITY
  const afterAmount = mentions.find((mention) =>
    mention.index >= amount.end && mention.index < nextAmountStart
  )
  if (afterAmount) return afterAmount

  const previousAmountEnd = amounts[index - 1]?.end ?? 0
  return mentions.find((mention) =>
    mention.index >= previousAmountEnd && mention.index < amount.start
  ) || null
}

function deriveItemDescription(text, amountEntity, index) {
  const fragmentStart = Math.max(
    String(text).lastIndexOf(',', amountEntity.start),
    String(text).lastIndexOf(' dan ', amountEntity.start),
    String(text).lastIndexOf(' lalu ', amountEntity.start),
    0
  )
  const fragment = String(text)
    .slice(fragmentStart, amountEntity.start)
    .replace(/\b(?:dan|lalu|terus|catat|simpan|tolong|hari ini|tadi)\b/giu, ' ')
    .replace(/[,\s]+/g, ' ')
    .trim()

  return fragment || `Transaksi ${index + 1}`
}

function toWalletSlot(entity) {
  if (!entity?.id) return null
  return { id: entity.id, name: entity.name }
}

function hasSlotValue(value) {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'number') return Number.isFinite(value) && value > 0
  if (typeof value === 'string') return value.trim().length > 0
  if (value && typeof value === 'object' && 'id' in value) {
    return Boolean(value.id)
  }
  return Boolean(value)
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined)
  )
}
