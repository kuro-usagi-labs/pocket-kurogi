import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useWallets() {
  const { user } = useAuth()
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchWalletById = useCallback(async (id) => {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    return { data, error }
  }, [user])

  const addWallet = useCallback(async (name, initialBalance = 0, walletType = 'cash') => {
    if (!user) return { error: 'Not authenticated' }

    const normalizedInitialBalance = Number(initialBalance || 0)
    const rpcResult = await supabase.rpc('create_wallet_with_opening_balance', {
      p_name: name,
      p_initial_balance: normalizedInitialBalance,
      p_wallet_type: walletType,
      p_tone: null,
    })

    if (!rpcResult.error && rpcResult.data?.wallet_id) {
      const { data: insertedWallet, error: fetchError } = await fetchWalletById(rpcResult.data.wallet_id)

      if (fetchError || !insertedWallet) {
        const fallbackWallet = {
          id: rpcResult.data.wallet_id,
          user_id: user.id,
          name: rpcResult.data.wallet_name || name,
          wallet_type: rpcResult.data.wallet_type || walletType,
          initial_balance: Number(rpcResult.data.initial_balance ?? normalizedInitialBalance),
          current_balance: Number(rpcResult.data.current_balance ?? normalizedInitialBalance),
          tone: rpcResult.data.tone || '#0F172A',
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        setWallets((prev) => (
          prev.some((wallet) => wallet.id === fallbackWallet.id)
            ? prev
            : [...prev, fallbackWallet]
        ))

        return { data: fallbackWallet, error: null, ledgerCreated: normalizedInitialBalance > 0 }
      }

      setWallets((prev) => (
        prev.some((wallet) => wallet.id === insertedWallet.id)
          ? prev
          : [...prev, insertedWallet]
      ))
      return { data: insertedWallet, error: null, ledgerCreated: normalizedInitialBalance > 0 }
    }

    return {
      data: null,
      error: rpcResult.error ?? new Error('Dompet tidak bisa dibuat saat ini.'),
      ledgerCreated: false,
    }
  }, [fetchWalletById, user])

  const fetchWallets = useCallback(async () => {
    if (!user) {
      setWallets([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_archived', false)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setWallets(data)
      if (data.length === 0) {
        const ensureResult = await supabase.rpc('ensure_default_wallet')
        if (!ensureResult.error) {
          const { data: refreshedWallets, error: refreshError } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_archived', false)
            .order('created_at', { ascending: true })

          if (!refreshError && refreshedWallets) {
            setWallets(refreshedWallets)
          }
        }
      }
    }

    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchWallets()
  }, [fetchWallets])

  const deleteWallet = useCallback(async (id) => {
    if (!user) return { error: 'Not authenticated' }

    const rpcResult = await supabase.rpc('archive_wallet_safely', {
      p_wallet_id: id,
    })

    if (!rpcResult.error) {
      await fetchWallets()
      return { error: null }
    }

    return { error: rpcResult.error }
  }, [fetchWallets, user])

  const hardDeleteWallet = useCallback(async (id) => {
    if (!user) return { error: 'Not authenticated' }

    const rpcResult = await supabase.rpc('delete_wallet_permanently_safe', {
      p_wallet_id: id,
    })

    if (!rpcResult.error) {
      await fetchWallets()
      return { error: null }
    }

    return { error: rpcResult.error }
  }, [fetchWallets, user])

  const clearAllWallets = useCallback(async () => {
    if (!user) return { error: 'Not authenticated' }

    return {
      error: new Error(
        'Dompet tidak bisa dihapus massal. Arsipkan satu per satu setelah saldonya dipindahkan agar ledger tetap aman.'
      ),
    }
  }, [user])

  const updateBalance = useCallback(async (walletId, amount, type) => {
    if (!user) return { error: 'Not authenticated' }

    const normalizedAmount = Number(amount)
    const delta = type === 'income' ? normalizedAmount : -normalizedAmount

    const rpcResult = await supabase.rpc('adjust_wallet_balance', {
      p_wallet_id: walletId,
      p_delta: delta,
    })

    if (!rpcResult.error) {
      const nextBalance = Number(rpcResult.data)
      setWallets((prev) =>
        prev.map((wallet) =>
          wallet.id === walletId ? { ...wallet, current_balance: nextBalance } : wallet
        )
      )
      return { error: null }
    }

    return { error: rpcResult.error ?? new Error('Saldo dompet tidak bisa diperbarui saat ini.') }
  }, [user])

  const totalBalance = wallets.reduce(
    (accumulator, wallet) => accumulator + Number(wallet.current_balance),
    0
  )

  return {
    wallets,
    loading,
    totalBalance,
    addWallet,
    deleteWallet,
    hardDeleteWallet,
    clearAllWallets,
    updateBalance,
    refetch: fetchWallets,
  }
}
