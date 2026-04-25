export function normalizeEntityName(value = '') {
  return String(value || '')
    .trim()
    .replace(/[^\p{L}\p{N}\s&-]/gu, ' ')
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

  const fuzzyMatches = findFuzzyMatches(normalizedInput, options)
  if (fuzzyMatches.length === 1) {
    return {
      match: null,
      candidates: fuzzyMatches,
      reason: 'fuzzy',
    }
  }

  if (fuzzyMatches.length > 1) {
    return {
      match: null,
      candidates: fuzzyMatches,
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

function findFuzzyMatches(normalizedInput, options = []) {
  const inputTokens = normalizedInput.split(/\s+/).filter(Boolean)

  return options
    .map((option) => {
      const normalizedOption = option.normalizedName || normalizeEntityName(option.name)
      const optionTokens = normalizedOption.split(/\s+/).filter(Boolean)
      const score = Math.min(
        typoDistance(normalizedInput, normalizedOption),
        ...inputTokens.flatMap((inputToken) =>
          optionTokens.map((optionToken) => typoDistance(inputToken, optionToken))
        )
      )
      const threshold = normalizedOption.length <= 5 ? 1 : 2

      return { option, score, threshold }
    })
    .filter(({ score, threshold }) => score <= threshold)
    .sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score
      return left.option.normalizedName.length - right.option.normalizedName.length
    })
    .map(({ option }) => option)
}

function typoDistance(left = '', right = '') {
  if (!left || !right) return Number.POSITIVE_INFINITY
  if (left === right) return 0

  const rows = left.length + 1
  const cols = right.length + 1
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0))

  for (let row = 0; row < rows; row += 1) matrix[row][0] = row
  for (let col = 0; col < cols; col += 1) matrix[0][col] = col

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      )
    }
  }

  return matrix[left.length][right.length]
}
