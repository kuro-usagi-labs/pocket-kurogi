import {
  inferCategoryFromText,
  resolveExistingCategory,
} from '../categoryCatalog'

export function resolveCategoryEntities({
  text = '',
  categories = [],
  transactionType = 'expense',
} = {}) {
  const inferred = inferCategoryFromText({ text, transactionType })
  if (!inferred.categoryName) return []

  const existing = resolveExistingCategory(
    categories,
    inferred.categoryName,
    transactionType
  )

  return [{
    id: existing.category?.id || null,
    name: existing.category?.name || inferred.categoryName,
    category: existing.category || null,
    transactionType,
    confidence: existing.category ? 0.96 : Number(inferred.confidence || 0.75),
    source: existing.category ? 'catalog' : 'inference',
    matchedKeyword: inferred.matchedKeyword || null,
    ambiguous: Boolean(existing.ambiguous),
    candidates: existing.candidates || [],
  }]
}
