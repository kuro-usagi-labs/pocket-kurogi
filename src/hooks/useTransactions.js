import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const TRANSACTION_SELECT = `
  *,
  wallets:wallet_id (name),
  categories:category_id (name, icon)
`

export function useTransactions() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  const mapTransactionRow = useCallback((transaction) => {
    const normalizedSource = normalizeTransactionSource(transaction.source)
    const analyticsBucket = deriveAnalyticsBucket({
      source: normalizedSource,
      transactionType: transaction.transaction_type,
      analyticsBucket: transaction.analytics_bucket,
    })

    return {
      id: transaction.id,
      type: transaction.transaction_type,
      amount: Number(transaction.amount),
      desc: transaction.merchant || transaction.notes || 'Transaksi',
      category: transaction.categories?.name || 'Lainnya',
      categoryIcon: transaction.categories?.icon || null,
      wallet: transaction.wallets?.name || 'Unknown',
      walletId: transaction.wallet_id,
      categoryId: transaction.category_id,
      time: new Date(transaction.occurred_at).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      date: formatRelativeDate(transaction.occurred_at),
      occurredAt: transaction.occurred_at,
      source: normalizedSource,
      analyticsBucket,
      canDelete: canDeleteLedgerEntry({
        source: normalizedSource,
        analyticsBucket,
      }),
    }
  }, [])

  const fetchTransactions = useCallback(async () => {
    if (!user) {
      setTransactions([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('transactions')
      .select(TRANSACTION_SELECT)
      .eq('user_id', user.id)
      .order('occurred_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      setTransactions(data.map(mapTransactionRow))
    }

    setLoading(false)
  }, [mapTransactionRow, user])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const fetchTransactionById = useCallback(async (id) => {
    const { data, error } = await supabase
      .from('transactions')
      .select(TRANSACTION_SELECT)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      return { data: null, error }
    }

    return { data: mapTransactionRow(data), error: null }
  }, [mapTransactionRow, user])

  const adjustWalletBalanceClientSide = useCallback(async (walletId, delta) => {
    const { data: currentWallet, error: fetchError } = await supabase
      .from('wallets')
      .select('current_balance')
      .eq('id', walletId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !currentWallet) {
      return { data: null, error: fetchError ?? new Error('Wallet not found') }
    }

    const newBalance = Number(currentWallet.current_balance) + delta
    const { error: updateError } = await supabase
      .from('wallets')
      .update({ current_balance: newBalance })
      .eq('id', walletId)
      .eq('user_id', user.id)

    if (updateError) {
      return { data: null, error: updateError }
    }

    return { data: newBalance, error: null }
  }, [user])

  const addTransaction = useCallback(async ({
    type,
    amount,
    desc,
    walletId,
    categoryId,
    source = 'chat',
  }) => {
    if (!user) return { data: null, error: 'Not authenticated' }

    const normalizedType = type?.toLowerCase()
    const normalizedAmount = Number(amount)
    const delta = normalizedType === 'income' ? normalizedAmount : -normalizedAmount
    const normalizedSource = normalizeTransactionSource(source)
    const analyticsBucket = deriveAnalyticsBucket({
      source: normalizedSource,
      transactionType: normalizedType,
    })

    const rpcResult = await supabase.rpc('record_transaction', {
      p_wallet_id: walletId,
      p_category_id: categoryId || null,
      p_transaction_type: normalizedType,
      p_amount: normalizedAmount,
      p_merchant: desc,
      p_source: normalizedSource,
    })

    if (!rpcResult.error && rpcResult.data?.transaction_id) {
      const { data: insertedTransaction, error: fetchError } = await fetchTransactionById(
        rpcResult.data.transaction_id
      )

      if (fetchError) {
        fetchTransactions().catch(() => null)
        return {
          data: {
            id: rpcResult.data.transaction_id,
            type: normalizedType,
            amount: normalizedAmount,
            desc,
            category: 'Lainnya',
            categoryIcon: null,
            wallet: 'Unknown',
            walletId,
            categoryId: categoryId || null,
            time: new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            date: 'Hari Ini',
            occurredAt: new Date().toISOString(),
            source: normalizedSource,
            analyticsBucket,
            canDelete: canDeleteLedgerEntry({
              source: normalizedSource,
              analyticsBucket,
            }),
          },
          error: null,
          balanceUpdated: true,
        }
      }

      setTransactions((prev) => [insertedTransaction, ...prev])
      return { data: insertedTransaction, error: null, balanceUpdated: true }
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        wallet_id: walletId,
        category_id: categoryId || null,
        transaction_type: normalizedType,
        amount: normalizedAmount,
        merchant: desc,
        source: normalizedSource,
        analytics_bucket: analyticsBucket,
      })
      .select(TRANSACTION_SELECT)
      .single()

    if (error || !data) {
      return { data: null, error: error ?? rpcResult.error, balanceUpdated: false }
    }

    const { error: balanceError } = await adjustWalletBalanceClientSide(walletId, delta)
    if (balanceError) {
      await supabase
        .from('transactions')
        .delete()
        .eq('id', data.id)
        .eq('user_id', user.id)

      return { data: null, error: balanceError, balanceUpdated: false }
    }

    const formatted = mapTransactionRow(data)
    setTransactions((prev) => [formatted, ...prev])
    return { data: formatted, error: null, balanceUpdated: true }
  }, [adjustWalletBalanceClientSide, fetchTransactionById, fetchTransactions, mapTransactionRow, user])

  const deleteTransaction = useCallback(async (id) => {
    if (!user) return { error: 'Not authenticated', balanceUpdated: false }

    const localTransaction =
      transactions.find((transaction) => transaction.id === id) ??
      (await fetchTransactionById(id)).data

    if (localTransaction && !localTransaction.canDelete) {
      return {
        error: new Error('Transaksi ini tidak bisa dihapus dari riwayat.'),
        balanceUpdated: false,
      }
    }

    const rpcResult = await supabase.rpc('delete_transaction_and_revert_balance', {
      p_transaction_id: id,
    })

    if (!rpcResult.error) {
      setTransactions((prev) => prev.filter((transaction) => transaction.id !== id))
      return { error: null, balanceUpdated: true }
    }

    const transactionToDelete = localTransaction

    if (!transactionToDelete) {
      return { error: rpcResult.error ?? new Error('Transaction not found'), balanceUpdated: false }
    }

    const delta = transactionToDelete.type?.toLowerCase() === 'income'
      ? -Number(transactionToDelete.amount)
      : Number(transactionToDelete.amount)

    const { error: balanceError } = await adjustWalletBalanceClientSide(
      transactionToDelete.walletId,
      delta
    )

    if (balanceError) {
      return { error: balanceError, balanceUpdated: false }
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      await adjustWalletBalanceClientSide(transactionToDelete.walletId, -delta)
      return { error, balanceUpdated: false }
    }

    setTransactions((prev) => prev.filter((transaction) => transaction.id !== id))
    return { error: null, balanceUpdated: true }
  }, [adjustWalletBalanceClientSide, fetchTransactionById, transactions, user])

  const clearTransactionsInRange = useCallback(async (startDate, endDate) => {
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', user.id)
      .gte('occurred_at', startDate)
      .lte('occurred_at', endDate)

    if (!error) fetchTransactions()
    return { error }
  }, [fetchTransactions, user])

  const clearAllTransactions = useCallback(async () => {
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', user.id)

    if (!error) setTransactions([])
    return { error }
  }, [user])

  const transferBetweenWallets = useCallback(async ({ fromWalletId, toWalletId, amount, description }) => {
    if (!user) return { error: 'Not authenticated' }

    const normalizedAmount = Number(amount)

    const rpcResult = await supabase.rpc('transfer_between_wallets', {
      p_from_wallet_id: fromWalletId,
      p_to_wallet_id: toWalletId,
      p_amount: normalizedAmount,
      p_description: description || null,
    })

    if (!rpcResult.error) {
      await fetchTransactions()
      return { error: null }
    }

    const { error: debitError } = await adjustWalletBalanceClientSide(fromWalletId, -normalizedAmount)
    if (debitError) {
      return { error: debitError }
    }

    const { error: creditError } = await adjustWalletBalanceClientSide(toWalletId, normalizedAmount)
    if (creditError) {
      await adjustWalletBalanceClientSide(fromWalletId, normalizedAmount)
      return { error: creditError }
    }

    const { error: insertError } = await supabase
      .from('transactions')
      .insert([
        {
          user_id: user.id,
          wallet_id: fromWalletId,
          transaction_type: 'expense',
          amount: normalizedAmount,
          merchant: description || 'Transfer keluar',
          source: 'transfer',
          analytics_bucket: 'internal_transfer',
        },
        {
          user_id: user.id,
          wallet_id: toWalletId,
          transaction_type: 'income',
          amount: normalizedAmount,
          merchant: description || 'Transfer masuk',
          source: 'transfer',
          analytics_bucket: 'internal_transfer',
        },
      ])

    if (insertError) {
      await adjustWalletBalanceClientSide(fromWalletId, normalizedAmount)
      await adjustWalletBalanceClientSide(toWalletId, -normalizedAmount)
      return { error: insertError }
    }

    await fetchTransactions()
    return { error: null }
  }, [adjustWalletBalanceClientSide, fetchTransactions, user])

  const totalIncome = transactions
    .filter((transaction) => transaction.analyticsBucket === 'income')
    .reduce((accumulator, transaction) => accumulator + transaction.amount, 0)

  const totalExpense = transactions
    .filter((transaction) => transaction.analyticsBucket === 'expense')
    .reduce((accumulator, transaction) => accumulator + transaction.amount, 0)

  return {
    transactions,
    loading,
    totalIncome,
    totalExpense,
    addTransaction,
    deleteTransaction,
    clearTransactionsInRange,
    clearAllTransactions,
    transferBetweenWallets,
    refetch: fetchTransactions,
  }
}

function normalizeTransactionSource(source) {
  const normalized = String(source || '')
    .trim()
    .toLowerCase()

  if (!normalized || normalized === 'app') {
    return 'chat'
  }

  return normalized
}

function deriveAnalyticsBucket({ source, transactionType, analyticsBucket = null }) {
  if (analyticsBucket) {
    return analyticsBucket
  }

  if (source === 'transfer') {
    return 'internal_transfer'
  }

  if (source === 'goal_contribution' || source === 'goal_initial_contribution') {
    return 'savings'
  }

  if (source === 'wallet_opening_balance') {
    return 'opening_balance'
  }

  return transactionType?.toLowerCase() === 'income' ? 'income' : 'expense'
}

function canDeleteLedgerEntry({ source, analyticsBucket }) {
  if (analyticsBucket !== 'income' && analyticsBucket !== 'expense') {
    return false
  }

  return ['chat', 'manual', 'ocr'].includes(source)
}

function formatRelativeDate(value) {
  const date = new Date(value)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = startOfToday.getTime() - startOfDate.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Hari Ini'
  if (days === 1) return 'Kemarin'
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}
