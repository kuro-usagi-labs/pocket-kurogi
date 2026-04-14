import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const EMPTY_ANALYTICS = {
  totalIncome: 0,
  totalExpense: 0,
  totalSavings: 0,
  netCashflow: 0,
  transferVolume: 0,
  topExpenseCategories: [],
}

export function useAnalytics() {
  const { user } = useAuth()
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS)
  const [loading, setLoading] = useState(true)

  const fetchAnalytics = useCallback(async () => {
    if (!user) {
      setAnalytics(EMPTY_ANALYTICS)
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase.rpc('get_analytics_snapshot', {
      p_start_at: null,
      p_end_at: null,
    })

    if (!error && data) {
      setAnalytics({
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
      })
    } else if (error) {
      setAnalytics(EMPTY_ANALYTICS)
    }

    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  return {
    analytics,
    loading,
    refetch: fetchAnalytics,
  }
}
