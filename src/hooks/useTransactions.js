import { useState, useEffect, useCallback, useRef } from 'react'
import { neon } from '../lib/neon'
import { useAuth } from '../contexts/AuthContext'
import { buildHistoryPresentation } from '../lib/historyPresentation'
import { inferCategoryFromText } from '../lib/categoryCatalog'

const TRANSACTION_SELECT = `
  *,
  wallets:wallet_id (name),
  categories:category_id (name, icon)
`
const PAGE_SIZE = 30

export function useTransactions() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const oldestCursorRef = useRef(null)

  const mapTransactionRow = useCallback((transaction) => {
    const normalizedSource = normalizeTransactionSource(transaction.source)
    const analyticsBucket = deriveAnalyticsBucket({
      source: normalizedSource,
      transactionType: transaction.transaction_type,
      analyticsBucket: transaction.analytics_bucket,
    })
    const walletName = transaction.wallets?.name || 'Unknown'
    const inferredCategory = inferCategoryFromText({
      text: [transaction.merchant, transaction.notes].filter(Boolean).join(' '),
      transactionType: transaction.transaction_type,
    })
    const categoryName = transaction.categories?.name || inferredCategory.categoryName || 'Lainnya'
    const historyPresentation = buildHistoryPresentation({
      merchant: transaction.merchant,
      notes: transaction.notes,
      source: normalizedSource,
      transactionType: transaction.transaction_type,
      walletName,
      categoryName,
    })

    return {
      id: transaction.id,
      type: transaction.transaction_type,
      amount: Number(transaction.amount),
      desc: transaction.merchant || transaction.notes || 'Transaksi',
      title: historyPresentation.title,
      subtitle: historyPresentation.subtitle,
      iconKey: historyPresentation.iconKey || null,
      merchant: transaction.merchant || null,
      notes: transaction.notes || null,
      category: categoryName,
      categoryIcon: transaction.categories?.icon || null,
      wallet: walletName,
      walletId: transaction.wallet_id,
      categoryId: transaction.category_id,
      time: new Date(transaction.occurred_at).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      date: formatRelativeDate(transaction.occurred_at),
      occurredAt: transaction.occurred_at,
      createdAt: transaction.created_at,
      source: normalizedSource,
      analyticsBucket,
      canDelete: canDeleteLedgerEntry({
        source: normalizedSource,
        analyticsBucket,
      }),
      canEdit: canDeleteLedgerEntry({
        source: normalizedSource,
        analyticsBucket,
      }),
    }
  }, [])

  const fetchTransactions = useCallback(async ({ loadMore = false } = {}) => {
    if (!user) {
      setTransactions([])
      setLoading(false)
      setLoadingMore(false)
      setHasMore(false)
      oldestCursorRef.current = null
      return
    }

    if (loadMore) {
      if (!oldestCursorRef.current) return
      setLoadingMore(true)
    } else {
      setLoading(true)
      oldestCursorRef.current = null
    }

    let query = neon
      .from('transactions')
      .select(TRANSACTION_SELECT)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (loadMore && oldestCursorRef.current) {
      query = query.lt('created_at', oldestCursorRef.current)
    }

    const { data, error } = await query

    if (!error && data) {
      const nextTransactions = data.map(mapTransactionRow)
      oldestCursorRef.current =
        nextTransactions[nextTransactions.length - 1]?.createdAt || null
      setHasMore(nextTransactions.length === PAGE_SIZE)

      if (loadMore) {
        setTransactions((prev) => {
          const merged = [...prev, ...nextTransactions]
          return merged.filter(
            (transaction, index, all) =>
              all.findIndex((candidate) => candidate.id === transaction.id) === index
          )
        })
      } else {
        setTransactions(nextTransactions)
      }
    } else if (!loadMore) {
      setTransactions([])
      setHasMore(false)
    }

    if (loadMore) {
      setLoadingMore(false)
    } else {
      setLoading(false)
    }
  }, [mapTransactionRow, user])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchTransactions().catch(() => null)
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [fetchTransactions])

  const fetchTransactionById = useCallback(async (id) => {
    const { data, error } = await neon
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
    notes = null,
    walletId,
    categoryId,
    source = 'chat',
    occurredAt = null,
  }) => {
    if (!user) return { data: null, error: 'Not authenticated' }

    const normalizedType = type?.toLowerCase()
    const normalizedAmount = Number(amount)
    const normalizedSource = normalizeTransactionSource(source)
    const analyticsBucket = deriveAnalyticsBucket({
      source: normalizedSource,
      transactionType: normalizedType,
    })

    const rpcResult = await neon.rpc('record_transaction', {
      p_wallet_id: walletId,
      p_category_id: categoryId || null,
      p_transaction_type: normalizedType,
      p_amount: normalizedAmount,
      p_merchant: desc,
      p_notes: notes || null,
      p_source: normalizedSource,
      p_occurred_at: occurredAt,
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
            title: desc,
            subtitle: categoryId ? 'Transaksi' : normalizedType === 'income' ? 'Pemasukan' : 'Pengeluaran',
            iconKey: normalizedType === 'income' ? 'income_general' : 'expense_general',
            merchant: desc,
            notes: notes || null,
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
            createdAt: new Date().toISOString(),
            source: normalizedSource,
            analyticsBucket,
            canDelete: canDeleteLedgerEntry({
              source: normalizedSource,
              analyticsBucket,
            }),
            canEdit: canDeleteLedgerEntry({
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

    const rpcResult = await neon.rpc('delete_transaction_and_revert_balance', {
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

  const replaceTransaction = useCallback(async ({
    transactionId,
    walletId,
    categoryId = null,
    type,
    amount,
    desc,
    notes = null,
    occurredAt = null,
  }) => {
    if (!user) return { data: null, error: 'Not authenticated', balanceUpdated: false }

    const localTransaction =
      transactions.find((transaction) => transaction.id === transactionId) ??
      (await fetchTransactionById(transactionId)).data

    if (localTransaction && !localTransaction.canEdit) {
      return {
        data: null,
        error: new Error('Transaksi ini tidak bisa dikoreksi langsung.'),
        balanceUpdated: false,
      }
    }

    const normalizedType = String(type || '').toLowerCase()
    const normalizedAmount = Number(amount)

    const rpcResult = await neon.rpc('replace_transaction_entry', {
      p_transaction_id: transactionId,
      p_wallet_id: walletId,
      p_category_id: categoryId || null,
      p_transaction_type: normalizedType,
      p_amount: normalizedAmount,
      p_merchant: desc,
      p_notes: notes || null,
      p_occurred_at: occurredAt,
    })

    if (rpcResult.error) {
      return {
        data: null,
        error: rpcResult.error ?? new Error('Transaksi tidak bisa diperbarui saat ini.'),
        balanceUpdated: false,
      }
    }

    const refreshedResult = await fetchTransactionById(transactionId)
    if (refreshedResult.error || !refreshedResult.data) {
      await fetchTransactions()
      return {
        data: null,
        error: refreshedResult.error ?? null,
        balanceUpdated: true,
      }
    }

    setTransactions((prev) =>
      prev.map((transaction) =>
        transaction.id === transactionId ? refreshedResult.data : transaction
      )
    )

    return {
      data: refreshedResult.data,
      error: null,
      balanceUpdated: true,
    }
  }, [fetchTransactionById, fetchTransactions, transactions, user])

  const clearTransactionsInRange = useCallback(async (startDate, endDate) => {
    if (!user) return { error: 'Not authenticated' }

    return {
      error: new Error(
        `Riwayat ${startDate} hingga ${endDate} tidak bisa dihapus massal.`
      ),
    }
  }, [user])

  const clearAllTransactions = useCallback(async () => {
    if (!user) return { error: 'Not authenticated' }

    return {
      error: new Error(
        'Riwayat tidak bisa dihapus massal. Hapus satu per satu.'
      ),
    }
  }, [user])

  const transferBetweenWallets = useCallback(async ({ fromWalletId, toWalletId, amount, description }) => {
    if (!user) return { error: 'Not authenticated' }

    const normalizedAmount = Number(amount)

    const rpcResult = await neon.rpc('transfer_between_wallets', {
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
    replaceTransaction,
    deleteTransaction,
    clearTransactionsInRange,
    clearAllTransactions,
    transferBetweenWallets,
    hasMore,
    loadingMore,
    loadMore: () => fetchTransactions({ loadMore: true }),
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
