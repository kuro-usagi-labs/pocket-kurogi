import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useTransactions() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTransactions = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        wallets:wallet_id (name),
        categories:category_id (name, icon)
      `)
      .eq('user_id', user.id)
      .order('occurred_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      setTransactions(
        data.map((t) => ({
          id: t.id,
          type: t.transaction_type,
          amount: Number(t.amount),
          desc: t.merchant || t.notes || 'Transaksi',
          category: t.categories?.name || 'Lainnya',
          categoryIcon: t.categories?.icon || null,
          wallet: t.wallets?.name || 'Unknown',
          walletId: t.wallet_id,
          categoryId: t.category_id,
          time: new Date(t.occurred_at).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          date: formatRelativeDate(new Date(t.occurred_at)),
          occurredAt: t.occurred_at,
        }))
      )
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const addTransaction = async ({ type, amount, desc, walletId, categoryId }) => {
    if (!user) return { error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        wallet_id: walletId,
        category_id: categoryId || null,
        transaction_type: type,
        amount,
        merchant: desc,
        source: 'app',
      })
      .select(`
        *,
        wallets:wallet_id (name),
        categories:category_id (name, icon)
      `)
      .single()

    if (!error && data) {
      const formatted = {
        id: data.id,
        type: data.transaction_type,
        amount: Number(data.amount),
        desc: data.merchant || 'Transaksi',
        category: data.categories?.name || 'Lainnya',
        categoryIcon: data.categories?.icon || null,
        wallet: data.wallets?.name || 'Unknown',
        walletId: data.wallet_id,
        categoryId: data.category_id,
        time: new Date(data.occurred_at).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        date: 'Hari Ini',
        occurredAt: data.occurred_at,
      }
      setTransactions((prev) => [formatted, ...prev])
      return { data: formatted, error: null }
    }
    return { data: null, error }
  }

  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((acc, t) => acc + t.amount, 0)
  const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0)

  const deleteTransaction = async (id) => {
    if (!user) return { error: 'Not authenticated' }
    
    // Optimistic update
    setTransactions((prev) => prev.filter(t => t.id !== id))
    
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      
    if (error) {
      fetchTransactions()
      return { error }
    }
    return { error: null }
  }

  return { transactions, loading, totalIncome, totalExpense, addTransaction, deleteTransaction, refetch: fetchTransactions }
}

function formatRelativeDate(date) {
  const now = new Date()
  const diff = now.setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0)
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Hari Ini'
  if (days === 1) return 'Kemarin'
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}
