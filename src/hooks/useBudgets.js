import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useBudgets() {
  const { user } = useAuth()
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchBudgets = useCallback(async () => {
    if (!user) {
      setBudgets([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('budgets')
      .select(`
        *,
        categories:category_id (name, icon)
      `)
      .eq('user_id', user.id)

    if (!error && data) {
      setBudgets(data)
    }

    setLoading(false)
  }, [user])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchBudgets().catch(() => null)
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [fetchBudgets])

  const setBudget = useCallback(async (categoryId, monthlyLimit) => {
    if (!user) return { error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('budgets')
      .upsert(
        {
          user_id: user.id,
          category_id: categoryId,
          monthly_limit: monthlyLimit,
        },
        { onConflict: 'user_id,category_id' }
      )
      .select()
      .single()

    if (!error && data) {
      fetchBudgets()
    }

    return { data, error }
  }, [fetchBudgets, user])

  const deleteBudget = useCallback(async (id) => {
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (!error) {
      setBudgets((prev) => prev.filter((budget) => budget.id !== id))
    }

    return { error }
  }, [user])

  return { budgets, loading, setBudget, deleteBudget, refetch: fetchBudgets }
}
