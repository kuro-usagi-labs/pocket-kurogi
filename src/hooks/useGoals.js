import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useGoals() {
  const { user } = useAuth()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchGoals = useCallback(async () => {
    if (!user) {
      setGoals([])
      setLoading(false)
      return
    }

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

  const addGoal = useCallback(async ({ name, targetAmount, deadline, icon, initialAmount = 0 }) => {
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
  }, [user])

  const updateGoalProgress = useCallback(async (id, amountToAdd) => {
    const goal = goals.find((currentGoal) => currentGoal.id === id)
    if (!goal) return { error: 'Goal not found' }

    const newAmount = Number(goal.current_amount) + amountToAdd
    const { data, error } = await supabase
      .from('goals')
      .update({
        current_amount: newAmount,
        status: newAmount >= goal.target_amount ? 'completed' : 'active',
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (!error && data) {
      setGoals((prev) => prev.map((currentGoal) => (currentGoal.id === id ? data : currentGoal)))
    }

    return { data, error }
  }, [goals, user])

  const contributeToGoal = useCallback(async ({ goalId, amount, walletId }) => {
    if (!user) return { data: null, error: 'Not authenticated', walletHandled: false }

    const rpcResult = await supabase.rpc('contribute_to_goal', {
      p_goal_id: goalId,
      p_amount: Number(amount),
      p_wallet_id: walletId,
    })

    if (!rpcResult.error) {
      await fetchGoals()
      return { data: rpcResult.data, error: null, walletHandled: true }
    }

    return { data: null, error: rpcResult.error, walletHandled: false }
  }, [fetchGoals, user])

  const createGoalWithContribution = useCallback(
    async ({ name, targetAmount, deadline, icon, initialAmount = 0, walletId = null }) => {
      if (!user) return { data: null, error: 'Not authenticated', walletHandled: false }

      const rpcResult = await supabase.rpc('create_goal_with_contribution', {
        p_name: name,
        p_target_amount: Number(targetAmount),
        p_deadline: deadline || null,
        p_icon: icon || '🎯',
        p_initial_amount: Number(initialAmount || 0),
        p_wallet_id: walletId,
      })

      if (!rpcResult.error) {
        await fetchGoals()
        return { data: rpcResult.data, error: null, walletHandled: Number(initialAmount || 0) > 0 }
      }

      return { data: null, error: rpcResult.error, walletHandled: false }
    },
    [fetchGoals, user]
  )

  const deleteGoal = useCallback(async (id) => {
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (!error) {
      setGoals((prev) => prev.filter((goal) => goal.id !== id))
    }

    return { error }
  }, [user])

  return {
    goals,
    loading,
    addGoal,
    updateGoalProgress,
    contributeToGoal,
    createGoalWithContribution,
    deleteGoal,
    refetch: fetchGoals,
  }
}
