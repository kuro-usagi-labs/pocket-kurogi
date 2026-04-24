import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { normalizeEntityName } from '../lib/chatEntities'

const DEFAULT_GOAL_ICON = '🎯'

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
    const timeoutId = setTimeout(() => {
      fetchGoals().catch(() => null)
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [fetchGoals])

  const addGoal = useCallback(async ({ name, targetAmount, deadline, icon, initialAmount = 0 }) => {
    if (!user) return { data: null, error: 'Not authenticated' }

    const rpcResult = await supabase.rpc('create_goal_with_contribution', {
      p_name: name,
      p_target_amount: Number(targetAmount),
      p_deadline: deadline || null,
      p_icon: icon || DEFAULT_GOAL_ICON,
      p_initial_amount: Number(initialAmount || 0),
      p_wallet_id: null,
    })

    if (!rpcResult.error) {
      await fetchGoals()
      return { data: rpcResult.data, error: null }
    }

    return { data: null, error: rpcResult.error }
  }, [fetchGoals, user])

  const updateGoalProgress = useCallback(async (id) => {
    return {
      data: null,
      error: new Error(
        `Progress target ${id} tidak bisa diubah langsung. Gunakan flow setoran target agar saldo dan ledger tetap sinkron.`
      ),
    }
  }, [])

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

  const withdrawFromGoal = useCallback(async ({ goalId, amount, walletId, description = null }) => {
    if (!user) {
      return { data: null, error: 'Not authenticated', walletHandled: false, ledgerHandled: false }
    }

    const rpcResult = await supabase.rpc('withdraw_from_goal', {
      p_goal_id: goalId,
      p_amount: Number(amount),
      p_wallet_id: walletId,
      p_description: description,
    })

    if (!rpcResult.error) {
      await fetchGoals()
      return { data: rpcResult.data, error: null, walletHandled: true, ledgerHandled: true }
    }

    return { data: null, error: rpcResult.error, walletHandled: false, ledgerHandled: false }
  }, [fetchGoals, user])

  const createGoalWithContribution = useCallback(
    async ({ name, targetAmount, deadline, icon, initialAmount = 0, walletId = null }) => {
      if (!user) return { data: null, error: 'Not authenticated', walletHandled: false }

      const rpcResult = await supabase.rpc('create_goal_with_contribution', {
        p_name: name,
        p_target_amount: Number(targetAmount),
        p_deadline: deadline || null,
        p_icon: icon || DEFAULT_GOAL_ICON,
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

  const deleteGoal = useCallback(async ({ goalId, walletId = null }) => {
    if (!user) {
      return { data: null, error: 'Not authenticated', walletHandled: false, ledgerHandled: false }
    }

    const rpcResult = await supabase.rpc('delete_goal_and_restore_funds', {
      p_goal_id: goalId,
      p_wallet_id: walletId,
    })

    if (!rpcResult.error) {
      setGoals((prev) => prev.filter((goal) => goal.id !== goalId))
      return {
        data: rpcResult.data,
        error: null,
        walletHandled: Number(rpcResult.data?.refunded_amount || 0) > 0,
        ledgerHandled: Number(rpcResult.data?.refunded_amount || 0) > 0,
      }
    }

    return { data: null, error: rpcResult.error, walletHandled: false, ledgerHandled: false }
  }, [user])

  const renameGoal = useCallback(async (goalId, nextName) => {
    if (!user) return { error: 'Not authenticated' }

    const normalizedName = normalizeEntityName(nextName)
    if (!normalizedName) {
      return { error: new Error('Nama target wajib diisi.') }
    }

    const rpcResult = await supabase.rpc('rename_goal', {
      p_goal_id: goalId,
      p_name: nextName,
    })

    if (!rpcResult.error) {
      await fetchGoals()
      return { error: null }
    }

    return { error: rpcResult.error }
  }, [fetchGoals, user])

  return {
    goals,
    loading,
    addGoal,
    updateGoalProgress,
    contributeToGoal,
    withdrawFromGoal,
    createGoalWithContribution,
    deleteGoal,
    renameGoal,
    refetch: fetchGoals,
  }
}
