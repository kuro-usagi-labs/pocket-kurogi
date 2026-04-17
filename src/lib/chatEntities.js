export function normalizeEntityName(value = '') {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function normalizeNumericText(text = '') {
  return String(text || '').replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2')
}

export function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildWalletOptions(wallets = []) {
  return wallets.map((wallet) => ({
    id: wallet.id,
    name: wallet.name,
    normalizedName: normalizeEntityName(wallet.name),
    isArchived: Boolean(wallet.is_archived),
    walletType: wallet.wallet_type || 'cash',
    currentBalance: Number(wallet.current_balance || 0),
  }))
}

export function buildGoalOptions(goals = []) {
  return goals.map((goal) => ({
    id: goal.id,
    name: goal.name,
    normalizedName: normalizeEntityName(goal.name),
    status: goal.status || 'active',
    currentAmount: Number(goal.current_amount || 0),
    targetAmount: Number(goal.target_amount || 0),
  }))
}

export function matchMoney(text = '') {
  return normalizeNumericText(text).match(/(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta|m)?/i)
}

export function parseMoneyMatch(match) {
  if (!match) {
    return null
  }

  let amount = parseFloat(String(match[1] || '').replace(',', '.'))
  const multiplier = String(match[2] || '').toLowerCase()

  if (['k', 'rb', 'ribu'].includes(multiplier)) amount *= 1000
  else if (['jt', 'juta'].includes(multiplier)) amount *= 1000000
  else if (multiplier === 'm') amount *= 1000000000
  else if (amount > 0 && amount < 1000) amount *= 1000

  return amount
}

export function resolveOptionReference({
  input,
  options = [],
}) {
  const normalizedInput = normalizeEntityName(input)
  if (!normalizedInput) {
    return {
      match: null,
      candidates: [],
      reason: 'missing',
    }
  }

  const exactNormalizedMatch = options.find(
    (option) => option.normalizedName === normalizedInput
  )

  if (exactNormalizedMatch) {
    return {
      match: exactNormalizedMatch,
      candidates: [exactNormalizedMatch],
      reason: 'exact',
    }
  }

  const phraseMatches = options.filter((option) =>
    new RegExp(`(^|[^a-z0-9])${escapeRegExp(option.normalizedName)}([^a-z0-9]|$)`, 'i').test(
      normalizedInput
    )
  )

  if (phraseMatches.length === 1) {
    return {
      match: phraseMatches[0],
      candidates: phraseMatches,
      reason: 'phrase',
    }
  }

  if (phraseMatches.length > 1) {
    const sorted = [...phraseMatches].sort(
      (left, right) => right.normalizedName.length - left.normalizedName.length
    )
    const top = sorted[0]
    const runnerUp = sorted[1]

    if (top && (!runnerUp || top.normalizedName.length > runnerUp.normalizedName.length)) {
      return {
        match: top,
        candidates: sorted,
        reason: 'longest',
      }
    }

    return {
      match: null,
      candidates: sorted,
      reason: 'ambiguous',
    }
  }

  return {
    match: null,
    candidates: [],
    reason: 'missing',
  }
}

export function resolveOptionByIdOrName({
  id = null,
  name = '',
  options = [],
}) {
  if (id) {
    const idMatch = options.find((option) => option.id === id)
    if (idMatch) {
      return {
        match: idMatch,
        candidates: [idMatch],
        reason: 'id',
      }
    }
  }

  return resolveOptionReference({
    input: name,
    options,
  })
}

export function formatCandidateNames(candidates = []) {
  return candidates.map((candidate) => candidate.name).join(', ')
}

export function findOptionAfterKeyword({
  text,
  options = [],
  keywords = [],
  stopKeywords = [],
}) {
  const normalizedText = normalizeEntityName(text)

  for (const keyword of keywords) {
    const regex = new RegExp(`${escapeRegExp(normalizeEntityName(keyword))}\\s+(.+)$`, 'i')
    const match = normalizedText.match(regex)

    if (match?.[1]) {
      let candidateInput = match[1]

      for (const stopKeyword of stopKeywords) {
        const normalizedStopKeyword = normalizeEntityName(stopKeyword)
        const stopIndex = candidateInput.indexOf(` ${normalizedStopKeyword} `)

        if (stopIndex >= 0) {
          candidateInput = candidateInput.slice(0, stopIndex).trim()
        }
      }

      const resolution = resolveOptionReference({
        input: candidateInput,
        options,
      })

      if (resolution.match || resolution.candidates.length > 0) {
        return resolution
      }
    }
  }

  return {
    match: null,
    candidates: [],
    reason: 'missing',
  }
}
