import { useCallback, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { neon } from '../lib/neon'

export function useAccountReset() {
  const { user } = useAuth()
  const [resetting, setResetting] = useState(false)

  const resetAllData = useCallback(async () => {
    if (!user) {
      return { data: null, error: new Error('Sesi login tidak ditemukan.') }
    }

    setResetting(true)

    try {
      const result = await neon.rpc('reset_current_user_data')
      return result
    } catch (error) {
      return { data: null, error }
    } finally {
      setResetting(false)
    }
  }, [user])

  return { resetAllData, resetting }
}
