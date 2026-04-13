import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useBudgets() {
  const { user } = useAuth()
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchBudgets = useCallback(async () => {
    if (!user) return
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
    fetchBudgets()
  }, [fetchBudgets])

  const setBudget = async (categoryId, monthlyLimit) => {
    if (!user) return { error: 'Not authenticated' }
    
    // Upsert budget
    const { data, error } = await supabase
      .from('budgets')
      .upsert({
        user_id: user.id,
        category_id: categoryId,
        monthly_limit: monthlyLimit,
      }, { onConflict: 'user_id,category_id' })
      .select()
      .single()

    if (!error && data) {
      fetchBudgets() // Refresh list for category names
    }
    return { data, error }
  }

  const deleteBudget = async (id) => {
    const { error } = await supabase.from('budgets').delete().eq('id', id)
    if (!error) {
      setBudgets((prev) => prev.filter(b => b.id !== id))
    }
    return { error }
  }

  return { budgets, loading, setBudget, deleteBudget, refetch: fetchBudgets }
}
