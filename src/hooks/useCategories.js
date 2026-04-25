import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { normalizeEntityName } from '../lib/chatEntities'
import {
  DEFAULT_CATEGORY_TEMPLATES,
  buildAutoCategoryPayload,
  buildCategoryOptions,
  findFallbackCategory,
  normalizeCategoryLookup,
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
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (!error && data) {
      let nextCategories = data
      const existingNames = new Set(
        nextCategories.map((category) => normalizeCategoryLookup(category.name))
      )
      const missingDefaults = DEFAULT_CATEGORY_TEMPLATES.filter(
        (category) => !existingNames.has(normalizeCategoryLookup(category.name))
      )

      if (missingDefaults.length > 0) {
        const { error: seedError } = await supabase
          .from('categories')
          .insert(
            missingDefaults.map((category) => ({
              user_id: user.id,
              name: category.name,
              icon: category.icon,
              color: category.color,
              category_type: category.categoryType,
            }))
          )

        if (seedError) {
          console.warn('Default category sync failed:', seedError)
        } else {
          const { data: refreshedCategories, error: refreshError } = await supabase
            .from('categories')
            .select('*')
            .eq('user_id', user.id)
            .order('name', { ascending: true })

          if (!refreshError && refreshedCategories) {
            nextCategories = refreshedCategories
          }
        }
      }

      setCategories(nextCategories)
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

    const { data, error } = await supabase
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
      const { data: refreshedCategories } = await supabase
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
