import { isMutatingAssistantIntent } from './intentDefinitions'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const MAX_AMOUNT = 9_999_999_999_999.99

export function validateAssistantInterpretation({
  intent,
  entities = {},
  slots = {},
  route = null,
} = {}) {
  const errors = []
  const warnings = []
  const selectedMutation = isMutatingAssistantIntent(intent)
  const ambiguousMutation =
    intent === 'unknown' &&
    route?.alternatives?.some((candidate) =>
      isMutatingAssistantIntent(candidate.intent) && candidate.score >= 0.18
    )
  const explicitMutationLanguage =
    entities.amounts?.length > 0 &&
    (
      entities.transactionTypes?.length > 0 ||
      /\b(?:catat|simpan|rekam|input|masukkan|tambahkan|transfer|buat(?:kan)?|buatin|bikin(?:kan)?|bikinin|ubah|ganti|beli|bayar|terima|gaji|bonus)\b/iu.test(
        entities.normalizedText || ''
      )
    )
  const mutationLike =
    selectedMutation ||
    ambiguousMutation ||
    explicitMutationLanguage

  if (entities.foreignCurrencies?.length) {
    errors.push(createIssue(
      'FOREIGN_CURRENCY',
      'Mata uang selain rupiah belum didukung untuk perubahan data.'
    ))
  }
  if (entities.thirdParty && mutationLike) {
    errors.push(createIssue(
      'THIRD_PARTY_OWNERSHIP',
      'Transaksi tampak milik orang lain, bukan milik pengguna.'
    ))
  }
  if (entities.hypothetical && mutationLike) {
    errors.push(createIssue(
      'HYPOTHETICAL_OR_FUTURE',
      'Kalimat masih berupa rencana atau kemungkinan.'
    ))
  }
  if (entities.question && mutationLike) {
    errors.push(createIssue(
      'QUESTION_NOT_ACTION',
      'Pertanyaan tidak boleh diperlakukan sebagai instruksi mutasi.'
    ))
  }
  if (entities.negated && mutationLike) {
    errors.push(createIssue(
      'NEGATED_ACTION',
      'Aksi mengandung negasi dan tidak aman untuk dijalankan.'
    ))
  }
  if (route?.ambiguous) {
    errors.push(createIssue(
      'AMBIGUOUS_INTENT',
      'Intent belum cukup jelas untuk dipilih secara deterministik.'
    ))
  }
  if (
    intent === 'create_wallet' &&
    entities.walletCreation?.walletName &&
    entities.wallets?.some((wallet) =>
      wallet.id &&
      wallet.source === 'explicit' &&
      normalizeName(wallet.name) === normalizeName(entities.walletCreation.walletName)
    )
  ) {
    errors.push(createIssue(
      'WALLET_ALREADY_EXISTS',
      'Dompet dengan nama tersebut sudah aktif.'
    ))
  }

  validateAmounts(slots, errors)
  validateWalletSlots(intent, slots, errors)

  if (entities.wallets?.some((wallet) => wallet.source === 'memory')) {
    warnings.push(createIssue(
      'MEMORY_DERIVED_WALLET',
      'Dompet berasal dari preferensi tersimpan dan harus terlihat pada konfirmasi.'
    ))
  }

  return {
    safe: errors.length === 0,
    errors,
    warnings,
  }
}

export function validatePendingActionExecution({
  action,
  userId,
  wallets = [],
  categories = [],
  now = new Date(),
} = {}) {
  const errors = []

  if (!action || typeof action !== 'object') {
    errors.push(createIssue('ACTION_MISSING', 'Pending action tidak ditemukan.'))
    return { safe: false, errors }
  }
  if (!userId || action.userId !== userId) {
    errors.push(createIssue('OWNERSHIP_MISMATCH', 'Pending action bukan milik sesi ini.'))
  }
  if (action.status !== 'confirmed') {
    errors.push(createIssue('ACTION_NOT_CONFIRMED', 'Pending action belum dikonfirmasi.'))
  }
  if (new Date(action.expiresAt).getTime() <= new Date(now).getTime()) {
    errors.push(createIssue('ACTION_EXPIRED', 'Pending action sudah kedaluwarsa.'))
  }
  if (!action.idempotencyKey) {
    errors.push(createIssue('IDEMPOTENCY_KEY_MISSING', 'Idempotency key wajib tersedia.'))
  }

  validateOwnedReferences(action.payload, wallets, categories, errors)
  validateAmounts(action.payload, errors)

  return { safe: errors.length === 0, errors }
}

function validateAmounts(value, errors, path = 'payload') {
  if (!value || typeof value !== 'object') return

  for (const [key, entry] of Object.entries(value)) {
    const nextPath = `${path}.${key}`
    if (key.toLowerCase().includes('amount') && entry !== null && entry !== undefined) {
      const amount = Number(entry)
      if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
        errors.push(createIssue('INVALID_AMOUNT', `Nominal tidak valid pada ${nextPath}.`))
      }
    } else if (entry && typeof entry === 'object') {
      validateAmounts(entry, errors, nextPath)
    }
  }
}

function validateWalletSlots(intent, slots, errors) {
  if (intent === 'transfer_money') {
    if (slots.sourceWallet?.id && slots.destinationWallet?.id &&
        slots.sourceWallet.id === slots.destinationWallet.id) {
      errors.push(createIssue(
        'SAME_TRANSFER_WALLET',
        'Dompet sumber dan tujuan transfer tidak boleh sama.'
      ))
    }
  }
}

function validateOwnedReferences(payload, wallets, categories, errors) {
  const walletIds = new Set(wallets.map((wallet) => wallet.id))
  const categoryIds = new Set(categories.map((category) => category.id))
  walk(payload, (key, value, path) => {
    if ((key === 'walletId' || key.endsWith('WalletId')) && value) {
      if (!UUID_PATTERN.test(String(value)) && !walletIds.has(value)) {
        errors.push(createIssue('INVALID_WALLET_ID', `Referensi dompet tidak valid pada ${path}.`))
      } else if (walletIds.size > 0 && !walletIds.has(value)) {
        errors.push(createIssue('WALLET_NOT_OWNED', `Dompet pada ${path} tidak dimiliki pengguna.`))
      }
    }
    if (key === 'categoryId' && value) {
      if (!UUID_PATTERN.test(String(value)) && !categoryIds.has(value)) {
        errors.push(createIssue('INVALID_CATEGORY_ID', `Referensi kategori tidak valid pada ${path}.`))
      } else if (categoryIds.size > 0 && !categoryIds.has(value)) {
        errors.push(createIssue('CATEGORY_NOT_OWNED', `Kategori pada ${path} tidak dimiliki pengguna.`))
      }
    }
  })
}

function walk(value, visitor, path = 'payload') {
  if (!value || typeof value !== 'object') return
  for (const [key, entry] of Object.entries(value)) {
    const nextPath = `${path}.${key}`
    visitor(key, entry, nextPath)
    if (entry && typeof entry === 'object') walk(entry, visitor, nextPath)
  }
}

function createIssue(code, message) {
  return { code, message }
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('id-ID')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}
