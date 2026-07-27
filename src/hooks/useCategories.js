import { useState, useEffect, useCallback, useMemo } from 'react'
import { neon } from '../lib/neon'
import { useAuth } from '../contexts/AuthContext'
import { normalizeEntityName } from '../lib/chatEntities'
import {
  buildAutoCategoryPayload,
  buildCategoryOptions,
  findFallbackCategory,
  resolveExistingCategory,
} from '../lib/categoryCatalog'

export function useCategories() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchCategories = useCallback(async () => {
    if (!user) {
      setCategories([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { error: seedError } = await neon.rpc('ensure_default_categories')
    if (seedError) {
      console.warn('Default category sync failed:', seedError)
    }

    const { data, error } = await neon
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (!error && data) {
      setCategories(data)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchCategories().catch(() => null)
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [fetchCategories])

  /**
   * Find the best matching category by name (case-insensitive fuzzy match).
   * Returns the category object or null.
   */
  const resolveCategory = useCallback((categoryName, { transactionType = 'expense' } = {}) => {
    const fallbackCategory = findFallbackCategory(categories)

    if (!categoryName) {
      return { category: fallbackCategory, ambiguous: false }
    }

    const resolution = resolveExistingCategory(categories, categoryName, transactionType)
    if (resolution.category) {
      return resolution
    }

    return {
      category: fallbackCategory,
      ambiguous: resolution.ambiguous,
    }
  }, [categories])

  const findCategory = useCallback(
    (categoryName, options = {}) => resolveCategory(categoryName, options).category,
    [resolveCategory]
  )

  const ensureCategory = useCallback(async ({
    name,
    transactionType = 'expense',
    icon = null,
    color = null,
  }) => {
    if (!user) {
      return { data: null, error: new Error('Not authenticated'), created: false }
    }

    const normalizedName = normalizeEntityName(name)
    if (!normalizedName) {
      return { data: null, error: new Error('Category name is required'), created: false }
    }

    const existingResolution = resolveExistingCategory(categories, name, transactionType)
    if (existingResolution.category) {
      return { data: existingResolution.category, error: null, created: false }
    }

    const categoryPayload = buildAutoCategoryPayload({
      categoryName: name,
      analysisCategory: name,
      transactionType,
    })

    if (!categoryPayload) {
      return {
        data: findFallbackCategory(categories),
        error: new Error('Category not found'),
        created: false,
      }
    }

    const { data, error } = await neon
      .from('categories')
      .insert({
        user_id: user.id,
        name: categoryPayload.name,
        icon: icon || categoryPayload.icon,
        color: color || categoryPayload.color,
        category_type: categoryPayload.categoryType,
      })
      .select('*')
      .single()

    if (error || !data) {
      const { data: refreshedCategories } = await neon
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (refreshedCategories) {
        setCategories(refreshedCategories)
      }

      const retryResolution = resolveExistingCategory(
        refreshedCategories || categories,
        categoryPayload.name,
        transactionType
      )
      if (retryResolution.category) {
        return { data: retryResolution.category, error: null, created: false }
      }

      return {
        data: null,
        error: error ?? new Error('Kategori tidak bisa dibuat saat ini.'),
        created: false,
      }
    }

    setCategories((prev) => {
      const next = prev.some((category) => category.id === data.id)
        ? prev
        : [...prev, data]

      return [...next].sort((left, right) => left.name.localeCompare(right.name, 'id-ID'))
    })

    return { data, error: null, created: true }
  }, [categories, user])

  const categoryOptions = useMemo(() => buildCategoryOptions(categories), [categories])

  return {
    categories,
    categoryOptions,
    loading,
    findCategory,
    resolveCategory,
    ensureCategory,
    refetch: fetchCategories,
  }
}
