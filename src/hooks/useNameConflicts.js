import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const EMPTY_CONFLICTS = {
  wallets: [],
  goals: [],
}

export function useNameConflicts() {
  const { user } = useAuth()
  const [conflicts, setConflicts] = useState(EMPTY_CONFLICTS)
  const [loading, setLoading] = useState(true)

  const fetchConflicts = useCallback(async () => {
    if (!user) {
      setConflicts(EMPTY_CONFLICTS)
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase.rpc('get_name_conflicts')

    if (!error && data) {
      setConflicts({
        wallets: Array.isArray(data.wallets) ? data.wallets : [],
        goals: Array.isArray(data.goals) ? data.goals : [],
      })
    } else {
      setConflicts(EMPTY_CONFLICTS)
    }

    setLoading(false)
  }, [user])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchConflicts().catch(() => null)
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [fetchConflicts])

  return {
    conflicts,
    loading,
    refetch: fetchConflicts,
  }
}
