import { normalizeEntityName } from './chatEntities'

const YES_PATTERN = /^(ya|iyaa?|iy|yes|ok(?:e+)?|siap|betul|benar)$/i
const NO_PATTERN = /^(tidak|gak|ga|no|batal|cancel|nggak)$/i

export function getWelcomeMessage({ balance = 0, transactionCount = 0 } = {}) {
  return {
    id: 'welcome',
    sender: 'bot',
    text:
      transactionCount === 0 && Number(balance || 0) <= 0
        ? 'Selamat datang. Mulai dengan isi saldo awal atau catat pemasukan pertamamu. Saya akan membantu langkah berikutnya.'
        : 'Halo. Catat transaksi atau tanya arus kasmu.',
  }
}

export function isAffirmative(text = '') {
  return YES_PATTERN.test(String(text || '').trim())
}

export function isNegative(text = '') {
  return NO_PATTERN.test(String(text || '').trim())
}

export function isDirectPendingWalletChoice(text, wallet) {
  const normalizedText = normalizeEntityName(text)
  const normalizedWallet = normalizeEntityName(wallet?.name)
  if (!normalizedText || !normalizedWallet) return false

  const paddedText = ` ${normalizedText} `
  const walletNeedle = ` ${normalizedWallet} `
  if (!paddedText.includes(walletNeedle)) return false

  const fillerWords = new Set([
    'pakai',
    'gunakan',
    'pilih',
    'yang',
    'dompet',
    'rekening',
    'wallet',
    'aja',
    'saja',
    'ya',
    'deh',
    'tolong',
  ])
  const remainingWords = paddedText
    .split(walletNeedle)
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  return remainingWords.every((word) => fillerWords.has(word))
}

export function isDirectPendingAmountAnswer(text, amountMatch) {
  if (!amountMatch?.[0]) return false

  const remainingWords = normalizeEntityName(
    String(text || '').replace(amountMatch[0], ' ')
  )
    .split(/\s+/)
    .filter(Boolean)
  const fillerWords = new Set([
    'target',
    'targetnya',
    'total',
    'totalnya',
    'nominal',
    'nominalnya',
    'sebesar',
    'jadi',
    'ya',
    'aja',
    'saja',
    'deh',
  ])

  return remainingWords.every((word) => fillerWords.has(word))
}

export function getCurrentTimeLabel() {
  return new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function materializeFinanceDraft(draft, requestId) {
  const id = draft?.id || draft?.requestId || requestId || globalThis.crypto?.randomUUID?.()
  const createdAt = draft?.createdAt || new Date().toISOString()
  const expiresAt = draft?.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  return {
    ...draft,
    id,
    requestId: draft?.requestId || id,
    createdAt,
    expiresAt,
  }
}

export function withWalletAttached(intent, wallet) {
  if (!intent || !wallet) return intent

  if (intent.type === 'transaction') {
    return { ...intent, walletId: wallet.id, wallet: wallet.name }
  }
  if (intent.type === 'transfer') {
    if (intent.unresolvedRole === 'source' || !intent.fromWalletId) {
      return { ...intent, fromWalletId: wallet.id, from: wallet.name }
    }
    return { ...intent, toWalletId: wallet.id, to: wallet.name }
  }
  if (intent.type === 'goal_withdrawal') {
    return {
      ...intent,
      destinationWalletId: wallet.id,
      wallet: wallet.name,
    }
  }
  if (intent.type === 'goal_contribution') {
    return {
      ...intent,
      sourceWalletId: wallet.id,
      sourceWallet: wallet.name,
    }
  }
  return intent
}

export function attachResolvedWallet(intent, wallet) {
  if (!intent || !wallet) return intent

  if (intent.type === 'transaction') {
    return { ...intent, walletId: wallet.id, wallet: wallet.name }
  }
  if (intent.type === 'goal_contribution') {
    return {
      ...intent,
      sourceWalletId: wallet.id,
      sourceWallet: wallet.name,
    }
  }
  if (intent.type === 'goal_withdrawal') {
    return {
      ...intent,
      destinationWalletId: wallet.id,
      wallet: wallet.name,
    }
  }
  if (intent.type === 'transfer') {
    if (intent.unresolvedRole === 'destination' || intent.toWalletId) {
      return { ...intent, toWalletId: wallet.id, to: wallet.name }
    }
    return { ...intent, fromWalletId: wallet.id, from: wallet.name }
  }
  if (['delete_wallet', 'rename_wallet', 'restore_wallet'].includes(intent.type)) {
    return { ...intent, walletId: wallet.id, wallet: wallet.name }
  }
  if (intent.type === 'correct_last_transaction') {
    return { ...intent, walletId: wallet.id, wallet: wallet.name }
  }
  return withWalletAttached(intent, wallet)
}

export function attachRawText(intent, rawText) {
  const normalizedRawText = String(rawText || '').trim()
  if (!intent || !normalizedRawText || intent.rawText === normalizedRawText) {
    return intent
  }
  return { ...intent, rawText: normalizedRawText }
}

export function shouldLearnCategory(categoryResolution) {
  if (!categoryResolution?.category?.id) return false
  if (normalizeEntityName(categoryResolution.category.name) === 'lainnya') {
    return false
  }
  return categoryResolution.resolution !== 'fallback' && !categoryResolution.ambiguous
}

export function buildCategoryFeedbackNote(categoryResolution, { created = false } = {}) {
  if (created && categoryResolution?.categoryName) {
    return `\n\nSaya juga membuat kategori **${categoryResolution.categoryName}** supaya transaksi serupa berikutnya lebih akurat.`
  }
  if (categoryResolution?.ambiguous) {
    return '\n\nKategori saya simpan ke **Lainnya** karena pilihan kategorinya masih ambigu.'
  }
  if (categoryResolution?.resolution === 'fallback') {
    return '\n\nKategori saya simpan ke **Lainnya** dulu karena konteks kategorinya belum cukup kuat.'
  }
  return ''
}

export function collectCategoryLearningKeywords(analysis, categoryResolution) {
  const hints = new Set()
  for (const hint of Array.isArray(analysis?.learningHints) ? analysis.learningHints : []) {
    const normalizedHint = String(hint || '').trim()
    if (normalizedHint) hints.add(normalizedHint)
  }
  if (categoryResolution?.keyword) {
    hints.add(String(categoryResolution.keyword).trim())
  }
  return [...hints].slice(0, 6)
}
