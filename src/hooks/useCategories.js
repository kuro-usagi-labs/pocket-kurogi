import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

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
  const findCategory = (categoryName) => {
    if (!categoryName) return null
    const lower = categoryName.toLowerCase()

    // Exact match first
    const exact = categories.find((c) => c.name.toLowerCase() === lower)
    if (exact) return exact

    // Partial match
    const partial = categories.find(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        lower.includes(c.name.toLowerCase())
    )
    return partial || null
  }

  return { categories, loading, findCategory, refetch: fetchCategories }
}
