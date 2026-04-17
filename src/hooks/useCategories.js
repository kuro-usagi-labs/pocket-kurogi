import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { normalizeEntityName } from '../lib/chatEntities'

export function useCategories() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchCategories = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (!error && data) setCategories(data)
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  /**
   * Find the best matching category by name (case-insensitive fuzzy match).
   * Returns the category object or null.
   */
  const resolveCategory = useCallback((categoryName) => {
    if (!categoryName) {
      return { category: null, ambiguous: false }
    }

    const normalizedName = normalizeEntityName(categoryName)
    const exact = categories.find((category) => normalizeEntityName(category.name) === normalizedName)

    if (exact) {
      return { category: exact, ambiguous: false }
    }

    const partialMatches = categories.filter((category) => {
      const normalizedCategory = normalizeEntityName(category.name)
      return normalizedCategory.includes(normalizedName) || normalizedName.includes(normalizedCategory)
    })

    if (partialMatches.length === 1) {
      return { category: partialMatches[0], ambiguous: false }
    }

    const fallbackCategory =
      categories.find((category) => normalizeEntityName(category.name) === 'lainnya') || null

    return {
      category: fallbackCategory,
      ambiguous: partialMatches.length > 1,
    }
  }, [categories])

  const findCategory = useCallback(
    (categoryName) => resolveCategory(categoryName).category,
    [resolveCategory]
  )

  return { categories, loading, findCategory, resolveCategory, refetch: fetchCategories }
}
