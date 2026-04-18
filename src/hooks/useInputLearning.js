import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useInputLearning() {
  const { user } = useAuth()
  const [categoryRules, setCategoryRules] = useState([])
  const [walletRules, setWalletRules] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRules = useCallback(async () => {
    if (!user) {
      setCategoryRules([])
      setWalletRules([])
      setLoading(false)
      return
    }

    setLoading(true)

    const [categoryResult, walletResult] = await Promise.all([
      supabase
        .from('smart_category_rules')
        .select('keyword, category_id, usage_count, updated_at')
        .eq('user_id', user.id)
        .order('usage_count', { ascending: false })
        .order('updated_at', { ascending: false }),
      supabase
        .from('smart_wallet_rules')
        .select('keyword, wallet_id, usage_count, updated_at')
        .eq('user_id', user.id)
        .order('usage_count', { ascending: false })
        .order('updated_at', { ascending: false }),
    ])

    if (!categoryResult.error) {
      setCategoryRules(categoryResult.data || [])
    }

    if (!walletResult.error) {
      setWalletRules(walletResult.data || [])
    }

    setLoading(false)
  }, [user])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchRules().catch(() => null)
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [fetchRules])

  const learnFromInput = useCallback(async ({
    rawText,
    walletId = null,
    categoryId = null,
    categoryKeywords = [],
    walletKeywords = [],
  }) => {
    if (!user || !rawText) {
      return { data: null, error: null }
    }

    const result = await supabase.rpc('learn_from_chat_input', {
      p_raw_text: rawText,
      p_wallet_id: walletId,
      p_category_id: categoryId,
      p_category_keywords: categoryKeywords,
      p_wallet_keywords: walletKeywords,
    })

    if (!result.error) {
      fetchRules().catch(() => null)
    }

    return result
  }, [fetchRules, user])

  return {
    categoryRules,
    walletRules,
    loading,
    learnFromInput,
    refetch: fetchRules,
  }
}
