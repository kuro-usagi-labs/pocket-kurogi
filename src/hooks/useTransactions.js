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

    return {
      data: null,
      error: rpcResult.error ?? new Error('Transaksi tidak bisa disimpan saat ini.'),
      balanceUpdated: false,
    }
  }, [fetchTransactionById, fetchTransactions, user])

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

    return {
      error: rpcResult.error ?? new Error('Transaksi tidak bisa dihapus saat ini.'),
      balanceUpdated: false,
    }
  }, [fetchTransactionById, transactions, user])

  const clearTransactionsInRange = useCallback(async (startDate, endDate) => {
    if (!user) return { error: 'Not authenticated' }

    return {
      error: new Error(
        `Riwayat ledger untuk ${startDate} hingga ${endDate} tidak bisa dihapus massal karena akan merusak saldo dan analytics.`
      ),
    }
  }, [user])

  const clearAllTransactions = useCallback(async () => {
    if (!user) return { error: 'Not authenticated' }

    return {
      error: new Error(
        'Riwayat ledger tidak bisa dihapus massal. Hapus transaksi satu per satu agar saldo ikut direvert dengan aman.'
      ),
    }
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

    return { error: rpcResult.error ?? new Error('Transfer tidak bisa diproses saat ini.') }
  }, [fetchTransactions, user])

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

  if (
    source === 'goal_contribution' ||
    source === 'goal_initial_contribution' ||
    source === 'goal_refund' ||
    source === 'goal_withdrawal'
  ) {
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
