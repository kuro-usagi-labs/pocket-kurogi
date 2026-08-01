import { getIntentDefinition } from './intentDefinitions'
import { sanitizeWalletName } from './walletCreationParser'

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
  const isCalculationFollowup =
    dialogueState?.activeIntent === 'calculate_change' &&
    intent === 'record_expense'
  const contextualDerived =
    dialogueState?.activeIntent === intent && dialogueState.missingSlots?.length
      ? Object.fromEntries(
          Object.entries(derived).filter(([key]) =>
            dialogueState.missingSlots.includes(key) ||
            key === 'transactionType'
          )
        )
      : isCalculationFollowup
        ? Object.fromEntries(
            Object.entries(derived).filter(([key]) =>
              !['amount', 'description'].includes(key)
            )
          )
        : derived
  const calculationFollowup = deriveCalculationFollowup(
    intent,
    dialogueState,
    text
  )
  const slots = {
    ...inherited,
    ...calculationFollowup,
    ...contextualDerived,
  }
  const definition = getIntentDefinition(intent)
  const requiredSlots = [...definition.required]
  if (
    intent === 'create_saving_goal' &&
    Number(slots.initialAmount || 0) > 0 &&
    !requiredSlots.includes('sourceWallet')
  ) {
    requiredSlots.push('sourceWallet')
  }
  const missingSlots = requiredSlots.filter((slot) => {
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
    requiredSlots,
    optionalSlots: definition.optional,
    missingSlots,
    complete: missingSlots.length === 0,
  }
}

function deriveSlots(intent, entities, text) {
  const candidate = (kind) => (entities.specialistCandidates || [])
    .find((entry) => entry.kind === kind)?.fields || null
  const compoundPurchase = candidate('compound_purchase')
  const incomingTransfer = candidate('incoming_transfer')
  const runwayScenario = candidate('runway_scenario')
  const goalPlan = candidate('goal_with_opening_deposit')
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

  if (intent === 'create_wallet') {
    return compactObject({
      walletName: entities.walletCreation?.walletName || null,
      walletType: entities.walletCreation?.walletType || 'cash',
      initialBalance: amount || 0,
    })
  }

  if (intent === 'rename_wallet') {
    return compactObject({
      wallet,
      nextWalletName: deriveRenamedWalletName(text),
    })
  }

  if (intent === 'archive_wallet') {
    return compactObject({ wallet })
  }

  if (intent === 'restore_wallet') {
    const archivedWallet = entities.archivedWallets?.[0]?.id
      ? {
          id: entities.archivedWallets[0].id,
          name: entities.archivedWallets[0].name,
        }
      : null
    return compactObject({ wallet: archivedWallet })
  }

  if (intent === 'deposit_goal') {
    return compactObject({
      amount: amount || deriveFullWalletAmount(text, entities.wallets?.[0]),
      goal,
      sourceWallet: wallet,
    })
  }

  if (intent === 'withdraw_goal') {
    return compactObject({
      amount,
      goal,
      destinationWallet: wallet,
      description,
      occurredAt,
    })
  }

  if (intent === 'calculate_change') {
    const changeDescription = /^(?:bayar|kembali|kembalian|susuk|uang|pakai)(?:\s+(?:bayar|kembali|kembalian|susuk|uang|pakai))*$/iu.test(
      String(description || '')
    )
      ? null
      : description
    return compactObject({
      tenderedAmount: entities.amounts?.[0]?.value || null,
      changeAmount: entities.amounts?.[1]?.value || null,
      description: changeDescription,
      wallet,
    })
  }

  if (intent === 'record_multiple_transactions') {
    return compactObject({
      items: compoundPurchase?.items || deriveMultipleItems(entities, text),
      wallet,
      occurredAt,
    })
  }

  if (intent === 'create_budget' || intent === 'update_budget') {
    return compactObject({ amount, category, period: 'monthly' })
  }

  if (intent === 'create_saving_goal') {
    return compactObject({
      amount: goalPlan?.targetAmount || amount,
      description: deriveSavingGoalDescription(text, entities),
      deadline: occurredAt,
      initialAmount: goalPlan?.initialAmount || null,
      sourceWallet: goalPlan?.sourceWallet || wallet,
    })
  }

  if (intent === 'financial_advice' && runwayScenario) {
    return compactObject({
      scenarioBalance: runwayScenario.scenarioBalance,
      horizonDays: runwayScenario.horizonDays,
      wallet,
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
      amount: incomingTransfer?.amount || compoundPurchase?.items?.[0]?.amount || amount,
      description: incomingTransfer?.description || compoundPurchase?.items?.[0]?.description || description,
      wallet,
      category,
      merchant: entities.merchants?.[0]?.name || null,
      occurredAt,
      transactionType: incomingTransfer?.transactionType || transactionType,
    })
  }

  return compactObject({
    wallet,
    category,
    goal,
    occurredAt,
  })
}

function deriveFullWalletAmount(text, walletEntity) {
  if (
    !/\b(?:semua|seluruh)(?:\s+(?:saldo|uang|isi|dana|dompet))?\b/iu.test(
      String(text || '')
    )
  ) {
    return null
  }
  const balance = Number(
    walletEntity?.wallet?.current_balance ??
    walletEntity?.wallet?.balance ??
    walletEntity?.current_balance ??
    0
  )
  return Number.isFinite(balance) && balance > 0 ? balance : null
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

function deriveRenamedWalletName(text) {
  const match = String(text || '').match(
    /\b(?:menjadi|jadi|ke|dengan nama)\s+(.+?)\s*(?:dong|ya|yah|deh)?$/iu
  )
  return sanitizeWalletName(match?.[1] || '')
}

function deriveCalculationFollowup(intent, dialogueState, text) {
  if (
    intent !== 'record_expense' ||
    dialogueState?.activeIntent !== 'calculate_change' ||
    !/\b(?:catat|simpan|rekam|masukkan|pengeluaran)\b/iu.test(String(text || ''))
  ) {
    return {}
  }
  const previous = dialogueState.collectedSlots || {}
  const spentAmount = Number(
    previous.spentAmount ||
    Number(previous.tenderedAmount || 0) - Number(previous.changeAmount || 0)
  )
  if (!Number.isFinite(spentAmount) || spentAmount <= 0) return {}
  return compactObject({
    amount: spentAmount,
    description: previous.description || 'Belanja tadi',
    wallet: previous.wallet || null,
  })
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
  const explicitName = String(text || '').match(
    /\b(?:dengan\s+nama|bernama|namanya)\s+(.+?)(?=\s+(?:(?:dengan\s+)?(?:target|nilai|nominal|sebesar|senilai)|setoran\s+awal|modal\s+awal|mulai\s+dengan|(?:rp\s*)?\d)|[,.;!?]|$)/iu
  )?.[1]
  if (explicitName) {
    return toSentenceCase(cleanGoalName(explicitName))
  }

  const cleaned = String(text || '')
    .replace(/(?:rp\s*)?\d+(?:[.,]\d+)?\s*(?:rupiah|ribu|rb|k|juta|jt|miliar)?/giu, ' ')
    .replace(/\b(?:tolong|mohon|buat|bikin|tambahkan|tambah|pasang|target|goal|tabungan|simpanan|menabung|nabung|sebesar|senilai|dengan|bernama|nama|namanya|setoran|modal|isi|saldo|awal|mulai|dari|pakai)\b/giu, ' ')
    .replace(/\b(?:hari ini|kemarin|besok|tanggal)\b/giu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
  return cleanGoalName(cleaned) || deriveDescription(text, entities)
}

function cleanGoalName(value) {
  return String(value || '')
    .replace(/\b(?:dong|ya|yah|deh|aja|saja)\b\s*$/iu, '')
    .replace(/^[\s,.;:!?-]+|[\s,.;:!?-]+$/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
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
