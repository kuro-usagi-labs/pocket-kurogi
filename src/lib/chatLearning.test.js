import { describe, expect, it } from 'vitest'
import { resolveCategoryForMessage } from './chatLearning'

const baseCategories = [
  { id: 'cat-makan', name: 'Makan', category_type: 'expense' },
  { id: 'cat-kopi', name: 'Kopi', category_type: 'expense' },
  { id: 'cat-listrik', name: 'Listrik', category_type: 'expense' },
  { id: 'cat-lainnya', name: 'Lainnya', category_type: 'both' },
]

describe('resolveCategoryForMessage', () => {
  it('maps learned keywords to the user category dictionary', () => {
    const result = resolveCategoryForMessage({
      text: 'beli golda dingin 10rb',
      categories: [
        ...baseCategories,
        { id: 'cat-jajan', name: 'Jajan', category_type: 'expense' },
      ],
      categoryRules: [
        {
          keyword: 'golda',
          category_id: 'cat-jajan',
          usage_count: 5,
          updated_at: '2026-04-18T00:00:00.000Z',
        },
      ],
      transactionType: 'expense',
    })

    expect(result).toMatchObject({
      resolution: 'learned',
      categoryName: 'Jajan',
    })
  })

  it('maps billing phrases to an existing compatible category before falling back', () => {
    const result = resolveCategoryForMessage({
      text: 'bayar token pln rumah 100rb',
      categories: baseCategories,
      transactionType: 'expense',
    })

    expect(result).toMatchObject({
      resolution: 'semantic',
      categoryName: 'Listrik',
    })
  })

  it('creates a safe new category when the local parser suggests a strong category that does not exist yet', () => {
    const result = resolveCategoryForMessage({
      text: 'beli golda dingin 10rb',
      categories: baseCategories,
      analysisCategory: 'Jajan',
      transactionType: 'expense',
    })

    expect(result.resolution).toBe('analysis_create')
    expect(result.createCategory).toMatchObject({
      name: 'Jajan',
      categoryType: 'expense',
    })
  })

  it('maps semantic categories to an existing custom category instead of duplicating', () => {
    const result = resolveCategoryForMessage({
      text: 'ngopi sore 35rb',
      categories: [
        { id: 'cat-ngopi', name: 'Ngopi', category_type: 'expense' },
        { id: 'cat-lainnya', name: 'Lainnya', category_type: 'both' },
      ],
      analysisCategory: 'Kopi',
      transactionType: 'expense',
    })

    expect(result.categoryName).toBe('Ngopi')
    expect(result.resolution).not.toBe('analysis_create')
  })
})
