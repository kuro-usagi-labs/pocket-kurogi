import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useWallets() {
  const { user } = useAuth()
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(true)

  const addWallet = useCallback(async (name, initialBalance = 0, walletType = 'cash') => {
    if (!user) return { error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('wallets')
      .insert({
        user_id: user.id,
        name,
        wallet_type: walletType,
        initial_balance: initialBalance,
        current_balance: initialBalance,
      })
      .select()
      .single()

    if (!error && data) {
      setWallets((prev) => [...prev, data])
    }

    return { data, error }
  }, [user])

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
        await addWallet('Tunai', 0, 'cash')
      }
    }

    setLoading(false)
  }, [addWallet, user])

  useEffect(() => {
    fetchWallets()
  }, [fetchWallets])

  const deleteWallet = useCallback(async (id) => {
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('wallets')
      .update({ is_archived: true })
      .eq('id', id)
      .eq('user_id', user.id)

    if (!error) {
      setWallets((prev) => prev.filter((wallet) => wallet.id !== id))
    }

    return { error }
  }, [user])

  const hardDeleteWallet = useCallback(async (id) => {
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('wallets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (!error) {
      setWallets((prev) => prev.filter((wallet) => wallet.id !== id))
    }

    return { error }
  }, [user])

  const clearAllWallets = useCallback(async () => {
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('wallets')
      .delete()
      .eq('user_id', user.id)

    if (!error) {
      setWallets([])
    }

    return { error }
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

    const { data: currentWallet, error: fetchError } = await supabase
      .from('wallets')
      .select('current_balance')
      .eq('id', walletId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !currentWallet) {
      return { error: fetchError ?? new Error('Wallet not found') }
    }

    const currentBalance = Number(currentWallet.current_balance)
    const newBalance = currentBalance + delta

    const { error: updateError } = await supabase
      .from('wallets')
      .update({ current_balance: newBalance })
      .eq('id', walletId)
      .eq('user_id', user.id)

    if (!updateError) {
      setWallets((prev) =>
        prev.map((wallet) =>
          wallet.id === walletId ? { ...wallet, current_balance: newBalance } : wallet
        )
      )
    }

    return { error: updateError }
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
