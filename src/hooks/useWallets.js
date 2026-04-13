import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useWallets() {
  const { user } = useAuth()
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchWallets = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_archived', false)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setWallets(data)
      // Auto-initialize if empty
      if (data.length === 0) {
        addWallet('Tunai', 0, 'cash')
      }
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchWallets()
  }, [fetchWallets])

  const addWallet = async (name, initialBalance = 0, walletType = 'cash') => {
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
  }

  const deleteWallet = async (id) => {
    const { error } = await supabase.from('wallets').update({ is_archived: true }).eq('id', id)
    if (!error) {
      setWallets((prev) => prev.filter((w) => w.id !== id))
    }
    return { error }
  }

  const updateBalance = async (walletId, amount, type) => {
    // Fetch latest balance from DB to avoid staleness (especially for new wallets)
    const { data: currentWallet, error: fetchError } = await supabase
      .from('wallets')
      .select('current_balance')
      .eq('id', walletId)
      .single()

    if (fetchError || !currentWallet) {
      console.error('Error fetching latest balance:', fetchError)
      return { error: fetchError }
    }

    const currentBalance = Number(currentWallet.current_balance)
    const newBalance = type === 'income' ? currentBalance + amount : currentBalance - amount

    const { error: updateError } = await supabase
      .from('wallets')
      .update({ current_balance: newBalance })
      .eq('id', walletId)

    if (!updateError) {
      setWallets((prev) =>
        prev.map((w) => (w.id === walletId ? { ...w, current_balance: newBalance } : w))
      )
    }
    return { error: updateError }
  }

  const totalBalance = wallets.reduce((acc, w) => acc + Number(w.current_balance), 0)

  return { wallets, loading, totalBalance, addWallet, deleteWallet, updateBalance, refetch: fetchWallets }
}
