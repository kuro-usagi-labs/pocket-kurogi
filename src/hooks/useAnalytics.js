import { useReducer, useRef, useEffect, useCallback } from 'react'
import { createFinancialReadState, reduceFinancialReadState } from '../lib/financialReadState'
import { neon } from '../lib/neon'
import { useAuth } from '../contexts/AuthContext'

const EMPTY_ANALYTICS = {
  totalIncome: 0,
  totalExpense: 0,
  totalSavings: 0,
  netCashflow: 0,
  transferVolume: 0,
  topExpenseCategories: [],
  topIncomeCategories: [],
}

export function useAnalytics() {
  const { user } = useAuth()
  const [state, dispatch] = useReducer(reduceFinancialReadState, user?.id, createFinancialReadState)
  const requestRef = useRef(0)

  const getSnapshot = useCallback(async ({ startAt = null, endAt = null } = {}) => {
    if (!user) {
      return { data: null, error: new Error('Silakan login untuk melihat laporan.') }
    }

    let result
    try { result = await neon.rpc('get_analytics_snapshot', {
      p_start_at: startAt,
      p_end_at: endAt,
    }) } catch (error) { return { data: null, error } }
    const { data, error } = result

    if (!error && data) {
      return {
        data: {
          totalIncome: Number(data.totalIncome || 0),
          totalExpense: Number(data.totalExpense || 0),
          totalSavings: Number(data.totalSavings || 0),
          netCashflow: Number(data.netCashflow || 0),
          transferVolume: Number(data.transferVolume || 0),
          topExpenseCategories: Array.isArray(data.topExpenseCategories)
            ? data.topExpenseCategories.map((category) => ({
                name: category.name || 'Lainnya',
                amount: Number(category.amount || 0),
                percentage: Number(category.percentage || 0),
              }))
            : [],
          topIncomeCategories: Array.isArray(data.topIncomeCategories)
            ? data.topIncomeCategories.map((category) => ({
                name: category.name || 'Lainnya',
                amount: Number(category.amount || 0),
                percentage: Number(category.percentage || 0),
              }))
            : [],
        },
        error: null,
      }
    }

    return { data: null, error: error || new Error('Laporan belum berhasil dimuat.') }
  }, [user])

  const fetchAnalytics = useCallback(async () => {
    const generation = ++requestRef.current
    const ownerId = user?.id
    dispatch({ type: 'start', ownerId, generation })
    if (!ownerId) return
    const { data, error } = await getSnapshot()
    if (generation !== requestRef.current) return
    dispatch({ type: error ? 'failure' : 'success', ownerId, generation, data, error,
      updatedAt: new Date().toISOString() })
  }, [getSnapshot, user])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchAnalytics().catch(() => null)
    }, 0)

    return () => { clearTimeout(timeoutId); requestRef.current += 1 }
  }, [fetchAnalytics])

  const visible = state.ownerId === user?.id ? state : createFinancialReadState(user?.id)
  return {
    analytics: visible.data || EMPTY_ANALYTICS,
    status: visible.status,
    error: visible.error,
    updatedAt: visible.updatedAt,
    loading: visible.status === 'loading',
    getSnapshot,
    refetch: fetchAnalytics,
  }
}
