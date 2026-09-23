import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { neon } from '../lib/neon'
import { transactionCursor, transactionCursorFilter } from '../lib/transactionCursor'

export function useWalletAdjustments(walletId) {
  const { user } = useAuth()
  const owner = user?.id
  const [state, setState] = useState({ items: [], status: 'loading', hasMore: false })
  const generation = useRef(0)
  const cursor = useRef(null)
  const busy = useRef(false)
  const fetchPage = useCallback(async (more = false) => {
    if (!owner || !walletId || (more && (busy.current || !cursor.current))) return
    const request = more ? generation.current : ++generation.current
    busy.current = true
    if (!more) cursor.current = null
    setState(previous => ({ ...previous, status: 'loading', error: null }))
    try {
      let query = neon.from('wallet_balance_adjustments').select('id,wallet_name,previous_balance,target_balance,created_at')
        .eq('user_id', owner).eq('wallet_id', walletId)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(30)
      if (more) query = query.or(transactionCursorFilter(cursor.current))
      const { data, error } = await query
      if (error) throw error
      if (!Array.isArray(data)) throw new Error('Riwayat belum tersedia.')
      if (request !== generation.current) return
      cursor.current = transactionCursor(data.at(-1))
      const rows = data.map(row => ({ ...row, difference: Number(row.target_balance) - Number(row.previous_balance) }))
      setState(previous => ({ owner, walletId, status: 'success', error: null, hasMore: data.length === 30,
        items: [...new Map([...(more ? previous.items : []), ...rows].map(row => [row.id, row])).values()] }))
    } catch (error) {
      if (request === generation.current) setState(previous => ({ ...previous, owner, walletId, status: 'error', error,
        items: previous.owner === owner && previous.walletId === walletId ? previous.items : [] }))
    } finally { if (request === generation.current) busy.current = false }
  }, [owner, walletId])
  useEffect(() => {
    const requestGeneration = generation
    const timer = setTimeout(() => fetchPage(), 0)
    return () => { clearTimeout(timer); requestGeneration.current += 1; cursor.current = null; busy.current = false }
  }, [fetchPage])
  const visible = state.owner === owner && state.walletId === walletId ? state : { items: [], status: 'loading', hasMore: false, error: null }
  return { ...visible, retry: () => fetchPage(), loadMore: () => fetchPage(true) }
}
