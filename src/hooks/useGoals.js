import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useGoals() {
  const { user } = useAuth()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchGoals = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setGoals(data)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  const addGoal = async ({ name, targetAmount, deadline, icon, initialAmount = 0 }) => {
    if (!user) return { error: 'Not authenticated' }
    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        name,
        target_amount: targetAmount,
        current_amount: initialAmount,
        deadline,
        icon: icon || '🎯',
      })
      .select()
      .single()

    if (!error && data) {
      setGoals((prev) => [...prev, data])
    }
    return { data, error }
  }

  const updateGoalProgress = async (id, amountToAdd) => {
    const goal = goals.find(g => g.id === id)
    if (!goal) return { error: 'Goal not found' }

    const newAmount = Number(goal.current_amount) + amountToAdd
    const { data, error } = await supabase
      .from('goals')
      .update({ 
        current_amount: newAmount,
        status: newAmount >= goal.target_amount ? 'completed' : 'active'
      })
      .eq('id', id)
      .select()
      .single()

    if (!error && data) {
      setGoals((prev) => prev.map(g => g.id === id ? data : g))
    }
    return { data, error }
  }

  const deleteGoal = async (id) => {
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (!error) {
      setGoals((prev) => prev.filter(g => g.id !== id))
    }
    return { error }
  }

  return { goals, loading, addGoal, updateGoalProgress, deleteGoal, refetch: fetchGoals }
}
