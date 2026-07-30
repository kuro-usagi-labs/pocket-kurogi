import { normalizeEntityName, resolveOptionReference } from '../chatEntities'

export function resolveWalletEntities({
  text = '',
  wallets = [],
  memory = [],
  allowSingleWalletFallback = false,
} = {}) {
  const activeWallets = wallets.filter((wallet) => !wallet?.is_archived)
  const semanticCashWallet = resolveSemanticCashWallet(text, activeWallets)
  if (semanticCashWallet) {
    return [createWalletEntity(semanticCashWallet, 'wallet')]
  }

  const options = activeWallets.map((wallet) => ({
    id: wallet.id,
    name: wallet.name,
    normalizedName: normalizeEntityName(wallet.name),
    aliases: wallet.aliases || [],
    wallet,
  }))
  const resolution = resolveOptionReference({ input: text, options })

  if (resolution.match) {
    return [{
      id: resolution.match.id,
      name: resolution.match.name,
      wallet: resolution.match.wallet || resolution.match,
      confidence: 0.99,
      source: 'explicit',
      candidates: [],
    }]
  }

  if (resolution.candidates.length > 0) {
    return [{
      id: null,
      name: null,
      wallet: null,
      confidence: 0,
      source: 'ambiguous',
      candidates: resolution.candidates,
    }]
  }

  const preferredWallet = resolvePreferredWallet(memory, activeWallets)
  if (preferredWallet) {
    return [{
      id: preferredWallet.id,
      name: preferredWallet.name,
      wallet: preferredWallet,
      confidence: 0.72,
      source: 'memory',
      candidates: [],
    }]
  }

  if (allowSingleWalletFallback && activeWallets.length === 1) {
    return [{
      id: activeWallets[0].id,
      name: activeWallets[0].name,
      wallet: activeWallets[0],
      confidence: 0.68,
      source: 'single_wallet',
      candidates: [],
    }]
  }

  return []
}

export function resolveTransferWallets({ text = '', wallets = [] } = {}) {
  const normalized = normalizeEntityName(text)
  const activeWallets = wallets.filter((wallet) => !wallet?.is_archived)
  const semanticCashWallet = resolveSemanticCashWallet(text, activeWallets)
  const mentions = activeWallets
    .flatMap((wallet) => {
      const names = [wallet.name, ...(wallet.aliases || [])]
      return names.map((name) => ({
        wallet,
        name,
        normalizedName: normalizeEntityName(name),
        index: normalized.indexOf(normalizeEntityName(name)),
      }))
    })
    .filter((mention) => mention.index >= 0)
    .sort((left, right) => left.index - right.index || right.normalizedName.length - left.normalizedName.length)
    .filter((mention, index, all) =>
      all.findIndex((candidate) => candidate.wallet.id === mention.wallet.id) === index
    )

  const fromMatch = normalized.match(/\b(?:dari|asal)\s+(.+?)(?=\s+(?:ke|menuju|masuk)\s+|$)/u)
  const toMatch = normalized.match(/\b(?:ke|menuju|masuk)\s+(.+)$/u)
  const source = matchWalletFragment(fromMatch?.[1], activeWallets) || mentions[0]?.wallet || null
  const destination =
    matchWalletFragment(toMatch?.[1], activeWallets) ||
    mentions.find((mention) => mention.wallet.id !== source?.id)?.wallet ||
    semanticCashWallet ||
    null

  return {
    source: source ? createWalletEntity(source, 'source') : null,
    destination: destination ? createWalletEntity(destination, 'destination') : null,
    ambiguous: Boolean(source && destination && source.id === destination.id),
  }
}

export function resolveWalletMentions({ text = '', wallets = [] } = {}) {
  const normalized = String(text || '').normalize('NFKC').toLowerCase()
  const activeWallets = wallets.filter((wallet) => !wallet?.is_archived)
  const mentions = activeWallets
    .filter((wallet) => !wallet?.is_archived)
    .flatMap((wallet) =>
      [wallet.name, ...(wallet.aliases || [])].map((name) => ({
        id: wallet.id,
        name: wallet.name,
        wallet,
        alias: name,
        index: normalized.indexOf(String(name || '').normalize('NFKC').toLowerCase()),
      }))
    )
    .filter((mention) => mention.index >= 0)
    .sort((left, right) => left.index - right.index)
    .filter((mention, index, all) =>
      all.findIndex((candidate) => candidate.id === mention.id) === index
    )

  const semanticCashWallet = resolveSemanticCashWallet(text, activeWallets)
  if (
    semanticCashWallet &&
    !mentions.some((mention) => mention.id === semanticCashWallet.id)
  ) {
    mentions.push({
      id: semanticCashWallet.id,
      name: semanticCashWallet.name,
      wallet: semanticCashWallet,
      alias: normalized.match(/\b(?:cash|tunai|kontan|uang fisik|uang kontan)\b/iu)?.[0] || 'tunai',
      index: Math.max(
        normalized.search(/\b(?:cash|tunai|kontan|uang fisik|uang kontan)\b/iu),
        0
      ),
    })
  }

  return mentions.sort((left, right) => left.index - right.index)
}

function resolvePreferredWallet(memory, wallets) {
  const preference = memory
    .filter((entry) => entry?.key === 'preferred_wallet' && Number(entry.confidence || 0) >= 0.75)
    .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))[0]

  if (!preference) return null
  return wallets.find((wallet) =>
    wallet.id === preference.value ||
    normalizeEntityName(wallet.name) === normalizeEntityName(preference.value)
  ) || null
}

function matchWalletFragment(fragment, wallets) {
  const normalizedFragment = normalizeEntityName(fragment)
  if (!normalizedFragment) return null
  const semanticCashWallet = resolveSemanticCashWallet(
    normalizedFragment,
    wallets
  )
  if (semanticCashWallet) return semanticCashWallet

  return [...wallets]
    .sort((left, right) => String(right.name).length - String(left.name).length)
    .find((wallet) => normalizedFragment.includes(normalizeEntityName(wallet.name))) || null
}

function resolveSemanticCashWallet(text, wallets) {
  if (!/\b(?:cash|tunai|kontan|uang fisik|uang kontan)\b/iu.test(String(text || ''))) {
    return null
  }

  const cashWallets = wallets.filter((wallet) => {
    const type = normalizeEntityName(
      wallet.wallet_type ||
      wallet.walletType ||
      wallet.type ||
      ''
    )
    const name = normalizeEntityName(wallet.name)
    return type === 'cash' || /\b(?:cash|tunai|kontan)\b/iu.test(name)
  })

  return cashWallets.length === 1 ? cashWallets[0] : null
}

function createWalletEntity(wallet, role) {
  return {
    id: wallet.id,
    name: wallet.name,
    wallet,
    role,
    confidence: 0.98,
    source: 'explicit',
  }
}
