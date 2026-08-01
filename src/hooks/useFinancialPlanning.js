import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { neon } from '../lib/neon'
import { resolveReminderPreferences } from '../lib/financialPlanning'

export function useFinancialPlanning() {
  const { user } = useAuth()
  const [schedules, setSchedules] = useState([])
  const [reminderRows, setReminderRows] = useState([])
  const [allocationPlan, setAllocationPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPlanning = useCallback(async () => {
    if (!user) {
      setSchedules([])
      setReminderRows([])
      setAllocationPlan(null)
      setLoading(false)
      setError(null)
      return { data: null, error: null }
    }

    setLoading(true)
    const [scheduleResult, reminderResult, allocationResult] = await Promise.all([
      neon.from('financial_schedules').select(`
        *,
        goals:goal_id (name),
        wallets:wallet_id (name),
        categories:category_id (name, icon)
      `).eq('user_id', user.id).order('next_due_date', { ascending: true }),
      neon.from('financial_reminder_preferences').select('*').eq('user_id', user.id),
      neon.from('income_allocation_plans').select('*').eq('user_id', user.id).maybeSingle(),
    ])
    const caughtError = scheduleResult.error || reminderResult.error || allocationResult.error || null
    if (!caughtError) {
      setSchedules(scheduleResult.data || [])
      setReminderRows(reminderResult.data || [])
      setAllocationPlan(allocationResult.data || null)
      setError(null)
    } else {
      setError(caughtError)
    }
    setLoading(false)
    return {
      data: caughtError ? null : {
        schedules: scheduleResult.data || [],
        reminderPreferences: reminderResult.data || [],
        allocationPlan: allocationResult.data || null,
      },
      error: caughtError,
    }
  }, [user])

  useEffect(() => {
    const timeoutId = setTimeout(() => fetchPlanning().catch(setError), 0)
    return () => clearTimeout(timeoutId)
  }, [fetchPlanning])

  const saveSchedule = useCallback(async (schedule) => {
    if (!user) return { data: null, error: new Error('Sesi login tidak tersedia.') }
    const result = await neon.rpc('save_financial_schedule', {
      p_schedule_id: schedule.id || null,
      p_title: String(schedule.title || '').trim(),
      p_schedule_type: schedule.scheduleType,
      p_amount: Number(schedule.amount),
      p_cadence: schedule.cadence,
      p_next_due_date: schedule.nextDueDate,
      p_goal_id: schedule.goalId || null,
      p_wallet_id: schedule.walletId || null,
      p_category_id: schedule.categoryId || null,
      p_reminder_enabled: schedule.reminderEnabled !== false,
      p_is_active: schedule.isActive !== false,
    })
    if (!result.error) await fetchPlanning()
    return result
  }, [fetchPlanning, user])

  const deleteSchedule = useCallback(async (id) => {
    if (!user) return { data: null, error: new Error('Sesi login tidak tersedia.') }
    const result = await neon.rpc('delete_financial_schedule', {
      p_schedule_id: id,
    })
    if (!result.error) {
      setSchedules((current) => current.filter((schedule) => schedule.id !== id))
    }
    return result
  }, [user])

  const setReminderPreference = useCallback(async (reminderType, enabled) => {
    if (!user) return { data: null, error: new Error('Sesi login tidak tersedia.') }
    const result = await neon.rpc('set_financial_reminder_preference', {
      p_reminder_type: reminderType,
      p_enabled: Boolean(enabled),
    })
    if (!result.error) await fetchPlanning()
    return result
  }, [fetchPlanning, user])

  const saveAllocationPlan = useCallback(async (plan) => {
    if (!user) return { data: null, error: new Error('Sesi login tidak tersedia.') }
    const result = await neon.rpc('save_income_allocation_plan', {
      p_monthly_income: Number(plan.monthlyIncome),
      p_needs_percent: Number(plan.needsPercent),
      p_savings_percent: Number(plan.savingsPercent),
      p_debt_percent: Number(plan.debtPercent),
      p_free_percent: Number(plan.freePercent),
    })
    if (!result.error) await fetchPlanning()
    return result
  }, [fetchPlanning, user])

  const reminderPreferences = useMemo(
    () => resolveReminderPreferences(reminderRows),
    [reminderRows]
  )

  return {
    schedules,
    reminderPreferences,
    allocationPlan,
    loading,
    error,
    saveSchedule,
    deleteSchedule,
    setReminderPreference,
    saveAllocationPlan,
    refetch: fetchPlanning,
  }
}
