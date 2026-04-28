import { useCallback } from 'react'
import {
  getTransactionDeletionDialogCopy,
  mapDomainError,
} from '../lib/domainMessages'

export function useTransactionActions({
  transactions,
  deleteTransaction,
  replaceTransaction,
  syncFinancialViews,
  showNotice,
  setActionDialog,
  formatRupiah,
}) {
  const deleteTransactionAndSync = useCallback(async (transactionId) => {
    const result = await deleteTransaction(transactionId)

    if (result.error) {
      return result
    }

    await syncFinancialViews({
      wallets: result.balanceUpdated,
      analytics: true,
    })

    return result
  }, [deleteTransaction, syncFinancialViews])

  const handleDeleteTransaction = useCallback(async (transactionId) => {
    const targetTransaction = transactions.find((transaction) => transaction.id === transactionId)

    if (!targetTransaction) {
      showNotice('Transaksi tidak ditemukan. Muat ulang histori lalu coba lagi.', 'error')
      return { error: new Error('Transaction not found') }
    }

    if (!targetTransaction.canDelete) {
      showNotice('Transaksi ini tidak bisa dihapus langsung dari histori.', 'error')
      return { error: new Error('Transaction cannot be deleted') }
    }

    setActionDialog({
      type: 'delete_transaction',
      transactionId,
      transactionTitle: targetTransaction.title || targetTransaction.desc || 'transaksi ini',
      ...getTransactionDeletionDialogCopy(targetTransaction, formatRupiah),
    })

    return { error: null }
  }, [formatRupiah, setActionDialog, showNotice, transactions])

  const undoLatestManualTransaction = useCallback(async () => {
    const lastDeletableTransaction = transactions.find((transaction) => transaction.canDelete)

    if (!lastDeletableTransaction) {
      return {
        data: null,
        error: new Error('Tidak ada transaksi manual yang bisa dibatalkan.'),
      }
    }

    const deleteResult = await deleteTransactionAndSync(lastDeletableTransaction.id)
    if (deleteResult.error) {
      return {
        data: null,
        error: deleteResult.error,
      }
    }

    return {
      data: lastDeletableTransaction,
      error: null,
    }
  }, [deleteTransactionAndSync, transactions])

  const handleUndoLastTransaction = useCallback(async () => {
    const lastDeletableTransaction = transactions.find((transaction) => transaction.canDelete)

    if (!lastDeletableTransaction) {
      showNotice('Tidak ada transaksi manual yang bisa dibatalkan.', 'error')
      return { error: new Error('No undoable transaction') }
    }

    setActionDialog({
      type: 'undo_transaction',
      transactionId: lastDeletableTransaction.id,
      transactionTitle: lastDeletableTransaction.title || lastDeletableTransaction.desc || 'transaksi terakhir',
      ...getTransactionDeletionDialogCopy(lastDeletableTransaction, formatRupiah, { mode: 'undo' }),
    })

    return { error: null }
  }, [formatRupiah, setActionDialog, showNotice, transactions])

  const handleUpdateTransaction = useCallback(async (payload) => {
    const result = await replaceTransaction(payload)

    if (result.error) {
      showNotice(mapDomainError(result.error), 'error')
      return result
    }

    await syncFinancialViews({
      wallets: result.balanceUpdated,
      analytics: true,
    })

    showNotice('Transaksi berhasil dikoreksi.', 'success')
    return result
  }, [replaceTransaction, showNotice, syncFinancialViews])

  const handleConfirmTransactionDialog = useCallback(async (actionDialog) => {
    const result = await deleteTransactionAndSync(actionDialog.transactionId)

    if (result.error) {
      showNotice(mapDomainError(result.error), 'error')
      return result
    }

    if (actionDialog.type === 'undo_transaction') {
      showNotice(`Transaksi terakhir (${actionDialog.transactionTitle}) dibatalkan.`, 'success')
      return result
    }

    showNotice(`Transaksi ${actionDialog.transactionTitle} berhasil dihapus.`, 'success')
    return result
  }, [deleteTransactionAndSync, showNotice])

  return {
    handleDeleteTransaction,
    handleUndoLastTransaction,
    handleUpdateTransaction,
    undoLatestManualTransaction,
    handleConfirmTransactionDialog,
  }
}
