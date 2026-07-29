export function normalizeResponseText(value = '') {
  return String(value || '')
    .toLocaleLowerCase('id-ID')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

export function selectFreshResponse(
  variants = [],
  {
    recentMessages = [],
    seed = '',
  } = {}
) {
  const candidates = [...new Set(
    variants.map((variant) => String(variant || '').trim()).filter(Boolean)
  )]
  if (candidates.length === 0) return null

  const recent = recentMessages
    .map(normalizeResponseText)
    .filter(Boolean)
    .slice(-12)
  const freshness = candidates.map((candidate, index) => ({
    candidate,
    index,
    lastUsed: findLastUsage(candidate, recent),
    similarity: greatestSimilarity(candidate, recent),
  }))
  const unused = freshness.filter((entry) =>
    entry.lastUsed === -1 && entry.similarity < 0.78
  )
  const pool = unused.length > 0
    ? unused
    : freshness
        .slice()
        .sort((left, right) =>
          left.lastUsed - right.lastUsed ||
          left.similarity - right.similarity ||
          left.index - right.index
        )
        .filter((entry, _index, sorted) =>
          entry.lastUsed === sorted[0].lastUsed &&
          entry.similarity === sorted[0].similarity
        )

  return pool[stableSelector(`${seed}:${recent.join('|')}`) % pool.length].candidate
}

export function isNearDuplicateResponse(left, right, threshold = 0.78) {
  const normalizedLeft = normalizeResponseText(left)
  const normalizedRight = normalizeResponseText(right)
  if (!normalizedLeft || !normalizedRight) return false
  if (
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  ) {
    return true
  }
  return tokenSimilarity(normalizedLeft, normalizedRight) >= threshold
}

function findLastUsage(candidate, recent) {
  const normalizedCandidate = normalizeResponseText(candidate)
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    if (
      recent[index].includes(normalizedCandidate) ||
      normalizedCandidate.includes(recent[index])
    ) {
      return index
    }
  }
  return -1
}

function greatestSimilarity(candidate, recent) {
  const normalizedCandidate = normalizeResponseText(candidate)
  return recent.reduce(
    (greatest, message) => Math.max(greatest, tokenSimilarity(normalizedCandidate, message)),
    0
  )
}

function tokenSimilarity(left, right) {
  const leftTokens = new Set(left.split(' ').filter(Boolean))
  const rightTokens = new Set(right.split(' ').filter(Boolean))
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length
  const union = new Set([...leftTokens, ...rightTokens]).size
  return intersection / union
}

function stableSelector(value) {
  return Array.from(String(value)).reduce(
    (hash, character) => ((hash * 31) + character.codePointAt(0)) >>> 0,
    2166136261
  )
}
