import { useState, useEffect, useCallback } from 'react'
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
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS)
  const [loading, setLoading] = useState(true)

  const getSnapshot = useCallback(async ({ startAt = null, endAt = null } = {}) => {
    if (!user) {
      return { data: EMPTY_ANALYTICS, error: null }
    }

    const { data, error } = await neon.rpc('get_analytics_snapshot', {
      p_start_at: startAt,
      p_end_at: endAt,
    })

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

    return { data: EMPTY_ANALYTICS, error }
  }, [user])

  const fetchAnalytics = useCallback(async () => {
    if (!user) {
      setAnalytics(EMPTY_ANALYTICS)
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await getSnapshot()

    if (!error) {
      setAnalytics(data)
    } else {
      setAnalytics(EMPTY_ANALYTICS)
    }

    setLoading(false)
  }, [getSnapshot, user])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchAnalytics().catch(() => null)
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [fetchAnalytics])

  return {
    analytics,
    loading,
    getSnapshot,
    refetch: fetchAnalytics,
  }
}
