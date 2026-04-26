import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useWallets } from '../../hooks/useWallets'
import { useTransactions } from '../../hooks/useTransactions'
import { useCategories } from '../../hooks/useCategories'
import { useGoals } from '../../hooks/useGoals'
import { useBudgets } from '../../hooks/useBudgets'
import { useInputLearning } from '../../hooks/useInputLearning'
import { analyzeTransaction } from '../../lib/gemini'
import BottomDock from './BottomDock'
import DesktopHeader from './DesktopHeader'
import DesktopSidebar from './DesktopSidebar'
import DesktopRightPanel from './DesktopRightPanel'
import AppHeader from './AppHeader'
import ActionConfirmModal from '../shared/ActionConfirmModal'
import StatusToast from '../shared/StatusToast'
import ChatView from '../Chat/ChatView'
import { useAdvisor } from '../../hooks/useAdvisor'
import { useChat } from '../../hooks/useChat'
import { useAnalytics } from '../../hooks/useAnalytics'
import { useNameConflicts } from '../../hooks/useNameConflicts'
import { buildAdviceReply, buildAnalyticsReply, resolveAnalyticsTimeframe } from '../../lib/analyticsChat'
import { resolveCategoryForMessage } from '../../lib/chatLearning'
import {
  buildGoalOptions,
  buildWalletOptions,
  formatCandidateNames,
  matchMoney,
  normalizeEntityName,
  parseMoneyMatch,
  resolveOptionReference,
} from '../../lib/chatEntities'

const YES_PATTERN = /^(ya|iyaa?|iy|yes|ok(?:e+)?|siap|betul|benar)$/i
const NO_PATTERN = /^(tidak|gak|ga|no|batal|cancel|nggak)$/i
const loadHistoryView = () => import('../History/HistoryView')
const loadWalletsView = () => import('../Wallets/WalletsView')
const loadAnalyticsView = () => import('../Analytics/AnalyticsView')
const HistoryView = lazy(loadHistoryView)
const WalletsView = lazy(loadWalletsView)
const AnalyticsView = lazy(loadAnalyticsView)
const WELCOME_MESSAGE = {
  id: 'welcome',
  sender: 'bot',
  text: 'Halo. Catat transaksi atau tanya arus kasmu.',
}

function isAffirmative(text = '') {
  return YES_PATTERN.test(String(text || '').trim())
}

function isNegative(text = '') {
  return NO_PATTERN.test(String(text || '').trim())
}

function getCurrentTimeLabel() {
  return new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ViewLoadingFallback() {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center">
      <div className="flex items-center gap-3 rounded-full border border-midnight/[0.08] bg-white px-4 py-3">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
        <span className="font-jakarta text-[12px] font-extrabold uppercase tracking-[0.14em] text-muted">
          Memuat
        </span>
      </div>
    </div>
  )
}

function buildWalletDeletionPrompt(wallet, formatRupiah, { markdown = false } = {}) {
  const balance = Number(wallet?.current_balance || 0)
  const walletName = wallet?.name || 'dompet ini'
  const highlightedName = markdown ? `**${walletName}**` : `"${walletName}"`

  if (balance !== 0) {
    const highlightedBalance = markdown ? `**${formatRupiah(balance)}**` : formatRupiah(balance)

    return [
      `Hapus dompet ${highlightedName}?`,
      `Saldo yang masih tersisa: ${highlightedBalance}.`,
      'Kalau lanjut, dompet dan riwayat transaksinya akan dihapus.',
      markdown
        ? 'Ketik "Ya" untuk konfirmasi atau "Batal" untuk membatalkan.'
        : 'Lanjutkan penghapusan?',
    ].join('\n\n')
  }

  return [
    `Hapus dompet ${highlightedName}?`,
    'Dompet dan riwayat transaksinya akan dihapus.',
    markdown
      ? 'Ketik "Ya" untuk konfirmasi atau "Batal" untuk membatalkan.'
      : 'Lanjutkan penghapusan?',
  ].join('\n\n')
}

function buildWalletDeletionSuccess(walletName) {
  return `Dompet **${walletName}** berhasil dihapus.`
}

function buildWalletRestorePrompt(wallet, { markdown = false } = {}) {
  const walletName = wallet?.name || 'dompet ini'
  const highlightedName = markdown ? `**${walletName}**` : `"${walletName}"`

  return [
    `Pulihkan dompet ${highlightedName} ke daftar aktif?`,
    'Dompet ini akan kembali muncul di daftar aktif dan bisa dipakai lagi untuk transaksi serta chat.',
    markdown
      ? 'Ketik "Ya" untuk konfirmasi atau "Batal" untuk membatalkan.'
      : 'Lanjutkan pemulihan?',
  ].join('\n\n')
}

function buildWalletRestoreSuccess(walletName) {
  return `Dompet **${walletName}** berhasil dipulihkan ke daftar aktif.`
}

function buildWalletDeletionNotice(walletName) {
  return `Dompet ${walletName} berhasil dihapus.`
}

function buildWalletRestoreNotice(walletName) {
  return `Dompet ${walletName} berhasil dipulihkan ke daftar aktif.`
}

function getWalletDeletionDialogCopy(wallet, formatRupiah) {
  const balance = Number(wallet?.current_balance || 0)
  const walletName = wallet?.name || 'dompet ini'

  if (balance !== 0) {
    return {
      title: `Hapus dompet "${walletName}"?`,
      paragraphs: [
        `Saldo yang masih tersisa: ${formatRupiah(balance)}.`,
        'Kalau lanjut, dompet dan riwayat transaksinya akan dihapus.',
      ],
      confirmLabel: 'Hapus Dompet',
      tone: 'danger',
    }
  }

  return {
    title: `Hapus dompet "${walletName}"?`,
    paragraphs: [
      'Dompet dan riwayat transaksinya akan dihapus.',
    ],
    confirmLabel: 'Hapus Dompet',
    tone: 'danger',
  }
}

function getGoalDeletionDialogCopy(goal, refundAmount, refundTargetName, formatRupiah) {
  if (refundAmount > 0) {
    return {
      title: `Hapus target "${goal?.name || 'target ini'}"?`,
      paragraphs: [
        `Dana sebesar ${formatRupiah(refundAmount)} akan dikembalikan ke dompet ${refundTargetName}.`,
        'Saldo dan histori tetap sinkron.',
      ],
      confirmLabel: 'Hapus Target',
      tone: 'danger',
    }
  }

  return {
    title: `Hapus target "${goal?.name || 'target ini'}"?`,
    paragraphs: [
      'Target ini akan dihapus.',
    ],
    confirmLabel: 'Hapus Target',
    tone: 'danger',
  }
}

function withWalletAttached(intent, wallet) {
  if (!intent || !wallet) {
    return intent
  }

  if (intent.type === 'transaction') {
    return {
      ...intent,
      walletId: wallet.id,
      wallet: wallet.name,
    }
  }

  if (intent.type === 'transfer') {
    if (intent.unresolvedRole === 'source' || !intent.fromWalletId) {
      return {
        ...intent,
        fromWalletId: wallet.id,
        from: wallet.name,
      }
    }

    return {
      ...intent,
      toWalletId: wallet.id,
      to: wallet.name,
    }
  }

  if (intent.type === 'goal_withdrawal') {
    return {
      ...intent,
      destinationWalletId: wallet.id,
      wallet: wallet.name,
    }
  }

  if (intent.type === 'goal_contribution') {
    return {
      ...intent,
      sourceWalletId: wallet.id,
      sourceWallet: wallet.name,
    }
  }

  return intent
}

function attachResolvedWallet(intent, wallet) {
  if (!intent || !wallet) {
    return intent
  }

  if (intent.type === 'transaction') {
    return {
      ...intent,
      walletId: wallet.id,
      wallet: wallet.name,
    }
  }

  if (intent.type === 'goal_contribution') {
    return {
      ...intent,
      sourceWalletId: wallet.id,
      sourceWallet: wallet.name,
    }
  }

  if (intent.type === 'goal_withdrawal') {
    return {
      ...intent,
      destinationWalletId: wallet.id,
      wallet: wallet.name,
    }
  }

  if (intent.type === 'transfer') {
    if (intent.unresolvedRole === 'destination' || intent.toWalletId) {
      return {
        ...intent,
        toWalletId: wallet.id,
        to: wallet.name,
      }
    }

    return {
      ...intent,
      fromWalletId: wallet.id,
      from: wallet.name,
    }
  }

  if (intent.type === 'delete_wallet' || intent.type === 'rename_wallet' || intent.type === 'restore_wallet') {
    return {
      ...intent,
      walletId: wallet.id,
      wallet: wallet.name,
    }
  }

  return withWalletAttached(intent, wallet)
}

function attachRawText(intent, rawText) {
  const normalizedRawText = String(rawText || '').trim()
  if (!intent || !normalizedRawText) {
    return intent
  }

  if (intent.rawText === normalizedRawText) {
    return intent
  }

  return {
    ...intent,
    rawText: normalizedRawText,
  }
}

function shouldLearnCategory(categoryResolution) {
  if (!categoryResolution?.category?.id) {
    return false
  }

  if (normalizeEntityName(categoryResolution.category.name) === 'lainnya') {
    return false
  }

  return categoryResolution.resolution !== 'fallback' && !categoryResolution.ambiguous
}

function buildCategoryFeedbackNote(categoryResolution, { created = false } = {}) {
  if (created && categoryResolution?.categoryName) {
    return `\n\nSaya juga membuat kategori **${categoryResolution.categoryName}** supaya transaksi serupa berikutnya lebih akurat.`
  }

  if (categoryResolution?.ambiguous) {
    return '\n\nKategori saya simpan ke **Lainnya** karena pilihan kategorinya masih ambigu.'
  }

  if (categoryResolution?.resolution === 'fallback') {
    return '\n\nKategori saya simpan ke **Lainnya** dulu karena konteks kategorinya belum cukup kuat.'
  }

  return ''
}

function collectCategoryLearningKeywords(analysis, categoryResolution) {
  const hints = new Set()

  for (const hint of Array.isArray(analysis?.learningHints) ? analysis.learningHints : []) {
    const normalizedHint = String(hint || '').trim()
    if (normalizedHint) {
      hints.add(normalizedHint)
    }
  }

  if (categoryResolution?.keyword) {
    hints.add(String(categoryResolution.keyword).trim())
  }

  return [...hints].slice(0, 6)
}

function mapDomainError(error) {
  const rawMessage = String(error?.message || error || '').trim()
  const message = rawMessage.toLowerCase()

  if (!rawMessage) {
    return 'Terjadi kesalahan saat memproses permintaan.'
  }

  if (message.includes('insufficient wallet balance')) {
    return 'Saldo dompet tidak cukup untuk menjalankan aksi ini.'
  }

  if (message.includes('goal balance is insufficient')) {
    return 'Saldo target tabungan tidak cukup untuk pencairan itu.'
  }

  if (message.includes('wallet not found') || message.includes('source wallet not found') || message.includes('destination wallet not found')) {
    return 'Dompet yang dimaksud tidak ditemukan atau sudah tidak aktif.'
  }

  if (message.includes('goal not found')) {
    return 'Target tabungan yang dimaksud tidak ditemukan.'
  }

  if (message.includes('wallet name is already in use')) {
    return 'Nama dompet itu sudah dipakai. Gunakan nama lain atau rename dompet yang bentrok.'
  }

  if (message.includes('wallet is already active')) {
    return 'Dompet itu sudah aktif, jadi tidak perlu dipulihkan lagi.'
  }

  if (message.includes('goal name is already in use')) {
    return 'Nama target itu sudah dipakai. Gunakan nama lain atau rename target yang bentrok.'
  }

  if (message.includes('category not found')) {
    return 'Kategori yang dipilih tidak ditemukan. Transaksi belum disimpan.'
  }

  if (message.includes('amount must be greater than zero')) {
    return 'Nominal harus lebih besar dari nol.'
  }

  if (message.includes('initial balance must not be negative') || message.includes('initial amount must not be negative')) {
    return 'Saldo awal tidak boleh negatif.'
  }

  if (message.includes('wallet is required')) {
    return 'Aksi ini butuh dompet sumber atau tujuan yang jelas.'
  }

  if (message.includes('unauthorized') || message.includes('jwt')) {
    return 'Sesi Anda untuk memanggil analisis AI sudah tidak valid. Muat ulang lalu login lagi.'
  }

  if (message.includes('goal name is required')) {
    return 'Nama target wajib diisi.'
  }

  if (message.includes('wallet name is required')) {
    return 'Nama dompet wajib diisi.'
  }

  if (
    message.includes('server live masih memakai aturan hapus wallet lama') ||
    message.includes('wallet masih memiliki saldo dan tidak bisa dihapus permanen') ||
    message.includes('wallet dengan riwayat ledger tidak bisa dihapus permanen')
  ) {
    return 'Server live Anda masih memakai aturan hapus wallet lama. Jalankan migration Supabase terbaru agar dompet bersaldo bisa dihapus permanen.'
  }

  return rawMessage
}

export default function AppShell() {
  const {
    wallets,
    archivedWallets,
    totalBalance,
    addWallet,
    deleteWallet,
    restoreWallet,
    renameWallet,
    refetch: refetchWallets,
  } = useWallets()

  const {
    transactions,
    addTransaction,
    deleteTransaction,
    transferBetweenWallets,
    hasMore: hasMoreTransactions,
    loadingMore: loadingMoreTransactions,
    loadMore: loadMoreTransactions,
    refetch: refetchTransactions,
  } = useTransactions()

  const {
    categories,
    categoryOptions,
    ensureCategory,
    resolveCategory,
  } = useCategories()
  const {
    goals,
    addGoal,
    contributeToGoal,
    withdrawFromGoal,
    createGoalWithContribution,
    deleteGoal,
    renameGoal,
    refetch: refetchGoals,
  } = useGoals()
  const { budgets } = useBudgets()
  const { categoryRules, learnFromInput } = useInputLearning()
  const {
    messages,
    saveMessage,
    hasMore: hasMoreMessages,
    loadingMore: loadingMoreMessages,
    loadMore: loadMoreMessages,
  } = useChat()
  const { analytics, getSnapshot, refetch: refetchAnalytics } = useAnalytics()
  const { conflicts, refetch: refetchNameConflicts } = useNameConflicts()

  const advisor = useAdvisor({
    wallets,
    totalBalance,
    transactions,
    analytics,
    goals,
    budgets,
  })

  const { getAIContextString, grandTotalBalance } = advisor

  const [activeTab, setActiveTab] = useState('chat')
  const [isTyping, setIsTyping] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [actionDialog, setActionDialog] = useState(null)
  const [dialogSubmitting, setDialogSubmitting] = useState(false)
  const [notice, setNotice] = useState(null)

  const walletOptions = useMemo(() => buildWalletOptions(wallets), [wallets])
  const archivedWalletOptions = useMemo(() => buildWalletOptions(archivedWallets), [archivedWallets])
  const goalOptions = useMemo(() => buildGoalOptions(goals), [goals])

  const formatRupiah = useCallback((number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(number)
  }, [])

  const syncFinancialViews = useCallback(
    async ({
      wallets: shouldRefreshWallets = false,
      transactions: shouldRefreshTransactions = false,
      goals: shouldRefreshGoals = false,
      analytics: shouldRefreshAnalytics = true,
      names: shouldRefreshNames = false,
    } = {}) => {
      const tasks = []

      if (shouldRefreshWallets) tasks.push(refetchWallets())
      if (shouldRefreshTransactions) tasks.push(refetchTransactions())
      if (shouldRefreshGoals) tasks.push(refetchGoals())
      if (shouldRefreshAnalytics) tasks.push(refetchAnalytics())
      if (shouldRefreshNames) tasks.push(refetchNameConflicts())

      if (tasks.length > 0) {
        await Promise.all(tasks)
      }
    },
    [refetchAnalytics, refetchGoals, refetchNameConflicts, refetchTransactions, refetchWallets]
  )

  const showNotice = useCallback((message, tone = 'info') => {
    setNotice({
      id: Date.now(),
      message,
      tone,
    })
  }, [])

  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setNotice((current) => (current?.id === notice.id ? null : current))
    }, 3600)

    return () => window.clearTimeout(timeoutId)
  }, [notice])

  useEffect(() => {
    loadHistoryView()
    loadWalletsView()
    loadAnalyticsView()
  }, [])

  const persistBotResponse = useCallback(async (response) => {
    if (!response?.text) {
      return
    }

    const extras = {}

    if (response.card) {
      extras.card = response.card
    }

    if (response.intentStatus) {
      extras.intentStatus = response.intentStatus
    }

    if (response.metadata) {
      extras.metadata = response.metadata
    }

    await saveMessage('bot', response.text, extras)
  }, [saveMessage])

  const handleDeleteTransaction = useCallback(async (transactionId) => {
    const result = await deleteTransaction(transactionId)

    if (result.error) {
      showNotice(mapDomainError(result.error), 'error')
      return result
    }

    await syncFinancialViews({
      wallets: result.balanceUpdated,
      analytics: true,
    })

    showNotice('Transaksi berhasil dihapus dan saldo terkait sudah diperbarui.', 'success')
    return result
  }, [deleteTransaction, showNotice, syncFinancialViews])

  const resolveTransactionCategory = useCallback(
    async ({ analysis, rawText }) => {
      const transactionType = analysis.transactionType || 'expense'
      const categoryResolution = resolveCategoryForMessage({
        text: rawText,
        categories,
        categoryRules,
        analysisCategory: analysis.category,
        transactionType,
      })

      let category = categoryResolution.category
      let created = false

      if (!category && categoryResolution.createCategory) {
        const ensureResult = await ensureCategory({
          name: categoryResolution.createCategory.name,
          transactionType,
          icon: categoryResolution.createCategory.icon,
          color: categoryResolution.createCategory.color,
        })

        if (ensureResult.error && !ensureResult.data) {
          console.warn('Category auto-create failed:', ensureResult.error)
        } else if (ensureResult.data) {
          category = ensureResult.data
          created = Boolean(ensureResult.created)
        }
      }

      const fallbackResolution = category
        ? { category, ambiguous: false }
        : resolveCategory('Lainnya', { transactionType })

      return {
        ...categoryResolution,
        category: category || fallbackResolution.category || null,
        categoryName:
          category?.name ||
          categoryResolution.categoryName ||
          fallbackResolution.category?.name ||
          analysis.category ||
          'Lainnya',
        created,
      }
    },
    [categories, categoryRules, ensureCategory, resolveCategory]
  )

  const executeIntent = useCallback(
    async (
      analysis,
      {
        source = 'chat',
        rawText = '',
        walletCatalog = wallets,
        archivedWalletCatalog = archivedWallets,
      } = {}
    ) => {
      if (!analysis || typeof analysis !== 'object') {
        return {
          text: 'Maaf, permintaan tersebut belum bisa saya pahami.',
        }
      }

      if (analysis.type === 'transaction') {
        const normalizedRawText = String(rawText || analysis.rawText || analysis.desc || '').trim()
        const resolvedWalletId = analysis.walletId || (walletCatalog.length === 1 ? walletCatalog[0].id : null)
        const resolvedWallet = walletCatalog.find((wallet) => wallet.id === resolvedWalletId)

        if (!resolvedWalletId || !resolvedWallet) {
          return {
            text: analysis.reply || 'Dompet untuk transaksi ini belum jelas. Sebutkan dompetnya secara spesifik.',
            intentStatus: 'needs_confirmation',
          }
        }

        const categoryResolution = await resolveTransactionCategory({
          analysis,
          rawText: normalizedRawText,
        })
        const category = categoryResolution.category
        const categoryName = categoryResolution.categoryName
        const description = analysis.desc || categoryName

        const transactionResult = await addTransaction({
          type: analysis.transactionType || 'expense',
          amount: analysis.amount,
          desc: description,
          walletId: resolvedWalletId,
          categoryId: category?.id || null,
          source,
        })

        if (transactionResult.error) {
          throw transactionResult.error
        }

        await syncFinancialViews({
          wallets: true,
          analytics: true,
        })

        if (normalizedRawText) {
          learnFromInput({
            rawText: normalizedRawText,
            walletId: resolvedWalletId,
            categoryId: shouldLearnCategory(categoryResolution) ? category?.id || null : null,
            categoryKeywords: collectCategoryLearningKeywords(analysis, categoryResolution),
          }).catch((error) => {
            console.warn('Learning update failed:', error)
          })
        }

        const note = buildCategoryFeedbackNote(categoryResolution, {
          created: categoryResolution.created,
        })

        return {
          text:
            (analysis.transactionType === 'income'
              ? `Pemasukan sebesar **${formatRupiah(analysis.amount)}** masuk ke dompet **${resolvedWallet.name}**.`
              : `Pengeluaran sebesar **${formatRupiah(analysis.amount)}** dicatat dari dompet **${resolvedWallet.name}**.`) +
            note,
          card: {
            type: analysis.transactionType,
            amount: analysis.amount,
            category: categoryName,
            wallet: resolvedWallet.name,
            desc: description,
          },
        }
      }

      if (analysis.type === 'analytics_query') {
        const timeframe = resolveAnalyticsTimeframe(analysis.period)
        const snapshotResult =
          timeframe.key === 'all_time'
            ? { data: analytics, error: null }
            : await getSnapshot({
                startAt: timeframe.startAt,
                endAt: timeframe.endAt,
              })

        if (snapshotResult.error) {
          throw snapshotResult.error
        }

        return {
          text:
            buildAnalyticsReply({
              query: {
                ...analysis,
                periodLabel: timeframe.label,
              },
              snapshot: snapshotResult.data,
              formatRupiah,
              goals,
            }) ||
            analysis.reply ||
            'Saya belum bisa membaca ringkasan data untuk pertanyaan itu saat ini.',
        }
      }

      if (analysis.type === 'advice') {
        const timeframe = resolveAnalyticsTimeframe(analysis.period)
        const snapshotResult =
          timeframe.key === 'all_time'
            ? { data: analytics, error: null }
            : await getSnapshot({
                startAt: timeframe.startAt,
                endAt: timeframe.endAt,
              })

        if (snapshotResult.error) {
          throw snapshotResult.error
        }

        return {
          text:
            analysis.reply ||
            buildAdviceReply({
              query: {
                ...analysis,
                periodLabel: timeframe.label,
              },
              snapshot: snapshotResult.data,
              budgets,
              goals,
              transactions,
              formatRupiah,
            }) ||
            'Analisa finansial tidak tersedia saat ini.',
        }
      }

      if (analysis.type === 'undo_transaction') {
        const lastDeletableTransaction = transactions.find((transaction) => transaction.canDelete)

        if (!lastDeletableTransaction) {
          throw new Error('Tidak ada transaksi manual yang bisa dibatalkan.')
        }

        const lastTransaction = lastDeletableTransaction
        const deleteResult = await handleDeleteTransaction(lastTransaction.id)

        if (deleteResult.error) {
          throw deleteResult.error
        }

        return {
          text: `Transaksi terakhir (${lastTransaction.desc}) telah dibatalkan.`,
        }
      }

      if (analysis.type === 'rename_wallet') {
        const walletToRename = walletCatalog.find((wallet) =>
          analysis.walletId ? wallet.id === analysis.walletId : wallet.name === analysis.wallet
        )

        if (!walletToRename) {
          throw new Error('Wallet not found')
        }

        const renameResult = await renameWallet(walletToRename.id, analysis.nextName)

        if (renameResult.error) {
          throw renameResult.error
        }

        await syncFinancialViews({
          wallets: true,
          names: true,
        })

        return {
          text: `Dompet **${walletToRename.name}** berhasil diubah menjadi **${renameResult.data.wallet_name}**.`,
        }
      }

      if (analysis.type === 'delete_wallet') {
        const walletToDelete = walletCatalog.find((wallet) =>
          analysis.walletId ? wallet.id === analysis.walletId : wallet.name === analysis.wallet
        )

        if (!walletToDelete) {
          throw new Error('Wallet not found')
        }

        setPendingAction({
          type: 'delete_wallet',
          walletId: walletToDelete.id,
          walletName: walletToDelete.name,
          currentBalance: Number(walletToDelete.current_balance || 0),
        })

        return {
          text: buildWalletDeletionPrompt(walletToDelete, formatRupiah, { markdown: true }),
          intentStatus: 'needs_confirmation',
        }
      }

      if (analysis.type === 'restore_wallet') {
        const walletToRestore = archivedWalletCatalog.find((wallet) =>
          analysis.walletId ? wallet.id === analysis.walletId : wallet.name === analysis.wallet
        )

        if (!walletToRestore) {
          throw new Error('Wallet not found')
        }

        setPendingAction({
          type: 'restore_wallet',
          walletId: walletToRestore.id,
          walletName: walletToRestore.name,
        })

        return {
          text: buildWalletRestorePrompt(walletToRestore, { markdown: true }),
          intentStatus: 'needs_confirmation',
        }
      }

      if (analysis.type === 'bulk_delete_wallets') {
        return {
          text: 'Dompet tidak bisa dihapus massal. Hapus satu per satu agar aman.',
        }
      }

      if (analysis.type === 'bulk_delete_transactions') {
        return {
          text: 'Riwayat tidak bisa dihapus massal. Hapus satu per satu.',
        }
      }

      if (analysis.type === 'check_balance') {
        if (!analysis.targetWalletId || analysis.target === 'all') {
          return {
            text: `Total gabungan saldo Anda adalah **${formatRupiah(totalBalance)}**.`,
          }
        }

        const matchedWallet = walletCatalog.find((wallet) => wallet.id === analysis.targetWalletId)
        if (!matchedWallet) {
          return {
            text: 'Dompet yang dimaksud tidak ditemukan.',
          }
        }

        return {
          text: `Saldo di dompet **${matchedWallet.name}** adalah **${formatRupiah(matchedWallet.current_balance || 0)}**.`,
        }
      }

      if (analysis.type === 'create_wallet') {
        const walletResult = await addWallet(
          analysis.name,
          analysis.initial_balance || 0,
          analysis.wallet_type || 'bank'
        )

        if (walletResult.error) {
          throw walletResult.error
        }

        await syncFinancialViews({
          transactions: walletResult.ledgerCreated,
          analytics: true,
          names: true,
        })

        return {
          text: `Dompet **${walletResult.data.name}** berhasil dibuat dengan saldo awal **${formatRupiah(walletResult.data.current_balance)}**.`,
        }
      }

      if (analysis.type === 'goal_contribution') {
        const targetGoal = goals.find((goal) => goal.id === analysis.goalId)
        const sourceWallet = walletCatalog.find((wallet) => wallet.id === analysis.sourceWalletId)

        if (!targetGoal) {
          throw new Error('Goal not found')
        }

        if (!sourceWallet) {
          return {
            text: `Setoran untuk target **${targetGoal.name}** perlu dompet sumber yang jelas. Sebutkan dompetnya, misalnya "tabung 100rb dari BCA ke ${targetGoal.name}".`,
            intentStatus: 'needs_confirmation',
          }
        }

        const contributionResult = await contributeToGoal({
          goalId: targetGoal.id,
          amount: analysis.amount,
          walletId: sourceWallet.id,
        })

        if (contributionResult.error) {
          throw contributionResult.error
        }

        await syncFinancialViews({
          wallets: contributionResult.walletHandled,
          transactions: true,
          analytics: true,
        })

        return {
          text:
            analysis.reply ||
            `Dana sebesar **${formatRupiah(analysis.amount)}** berhasil dipindahkan dari dompet **${sourceWallet.name}** ke target **${targetGoal.name}**.`,
        }
      }

      if (analysis.type === 'goal_creation_pending') {
        if (Number(analysis.targetAmount || 0) > 0) {
          const initialAmount = Number(analysis.amount || 0)
          const sourceWallet =
            initialAmount > 0
              ? walletCatalog.find((wallet) => wallet.id === analysis.sourceWalletId) ||
                (walletCatalog.length === 1 ? walletCatalog[0] : null)
              : null

          if (initialAmount > 0 && !sourceWallet) {
            setPendingAction({
              type: 'create_goal_source_wallet',
              name: analysis.name,
              targetAmount: Number(analysis.targetAmount),
              initialAmount,
            })

            return {
              text: `Target **${analysis.name}** akan dibuat. Setoran awal **${formatRupiah(initialAmount)}** mau diambil dari dompet mana? Pilihan aktif Anda: ${formatCandidateNames(walletOptions)}.`,
              intentStatus: 'needs_confirmation',
            }
          }

          const createGoalResult = await createGoalWithContribution({
            name: analysis.name,
            targetAmount: Number(analysis.targetAmount),
            initialAmount,
            walletId: sourceWallet?.id || null,
          })

          if (createGoalResult.error) {
            throw createGoalResult.error
          }

          await syncFinancialViews({
            wallets: createGoalResult.walletHandled,
            transactions: createGoalResult.walletHandled,
            analytics: true,
            names: true,
          })

          return {
            text:
              initialAmount > 0
                ? `Target **${analysis.name}** berhasil dibuat dengan target **${formatRupiah(analysis.targetAmount)}** dan setoran awal **${formatRupiah(initialAmount)}**.`
                : `Target **${analysis.name}** berhasil dibuat dengan target **${formatRupiah(analysis.targetAmount)}**.`,
          }
        }

        setPendingAction({
          type: 'create_goal_target',
          name: analysis.name,
          initialAmount: Number(analysis.amount || 0),
          sourceWalletId: analysis.sourceWalletId || null,
        })

        return {
          text:
            analysis.reply ||
            `Target tabungan **${analysis.name}** belum ada. Berapa nominal target totalnya? Contoh: 50jt atau 1000000.`,
          intentStatus: 'needs_confirmation',
        }
      }

      if (analysis.type === 'goal_withdrawal') {
        const targetGoal = goals.find((goal) => goal.id === analysis.goalId)
        const destinationWallet = walletCatalog.find((wallet) => wallet.id === analysis.destinationWalletId)

        if (!targetGoal) {
          throw new Error('Goal not found')
        }

        if (!destinationWallet) {
          return {
            text: `Dompet tujuan untuk pencairan **${targetGoal.name}** belum jelas. Sebutkan dompet tujuannya secara spesifik.`,
            intentStatus: 'needs_confirmation',
          }
        }

        const withdrawResult = await withdrawFromGoal({
          goalId: targetGoal.id,
          amount: analysis.amount,
          walletId: destinationWallet.id,
        })

        if (withdrawResult.error) {
          throw withdrawResult.error
        }

        await syncFinancialViews({
          wallets: withdrawResult.walletHandled,
          transactions: withdrawResult.ledgerHandled,
          analytics: true,
        })

        return {
          text:
            analysis.reply ||
            `Dana sebesar **${formatRupiah(analysis.amount)}** berhasil dipindahkan dari target **${targetGoal.name}** ke dompet **${destinationWallet.name}**.`,
        }
      }

      if (analysis.type === 'transfer') {
        const fromWallet = walletCatalog.find((wallet) => wallet.id === analysis.fromWalletId)
        const toWallet = walletCatalog.find((wallet) => wallet.id === analysis.toWalletId)

        if (!fromWallet || !toWallet) {
          return {
            text: analysis.prompt || [
              'Transfer antar dompet butuh dompet asal dan tujuan yang jelas.',
              'Format aman: "transfer 100rb dari BCA ke DANA".',
            ].join('\n'),
            intentStatus: 'needs_confirmation',
            metadata: walletCatalog.length
              ? {
                  candidates: walletCatalog.slice(0, 5).map((wallet) => ({
                    id: wallet.id,
                    name: wallet.name,
                  })),
                }
              : undefined,
          }
        }

        const transferResult = await transferBetweenWallets({
          fromWalletId: fromWallet.id,
          toWalletId: toWallet.id,
          amount: analysis.amount,
          description: `Transfer ${fromWallet.name} ke ${toWallet.name}`,
        })

        if (transferResult.error) {
          throw transferResult.error
        }

        await syncFinancialViews({
          wallets: true,
          analytics: true,
        })

        return {
          text:
            analysis.reply ||
            `Transfer sebesar **${formatRupiah(analysis.amount)}** dari **${fromWallet.name}** ke **${toWallet.name}** berhasil diproses.`,
        }
      }

      if (analysis.type === 'needs_confirmation') {
        const intentWithRawText = attachRawText(analysis.intent || null, rawText || analysis.rawText)

        if (analysis.reason === 'unknown_wallet' && analysis.action === 'create_wallet' && analysis.walletName) {
          setPendingAction({
            type: 'confirm_create_wallet',
            walletName: analysis.walletName,
            intent: intentWithRawText,
          })
        } else if (intentWithRawText) {
          setPendingAction({
            type: 'resolve_intent',
            reason: analysis.reason,
            intent: intentWithRawText,
            candidates: analysis.candidates || [],
          })
        }

        return {
          text: analysis.prompt || 'Saya masih butuh klarifikasi sebelum memproses aksi ini.',
          intentStatus: 'needs_confirmation',
          metadata: analysis.candidates?.length
            ? {
                candidates: analysis.candidates.map((candidate) => ({
                  id: candidate.id,
                  name: candidate.name,
                })),
              }
            : undefined,
        }
      }

      if (analysis.type === 'confirm') {
        return {
          text: 'Belum ada aksi yang menunggu konfirmasi.',
        }
      }

      if (analysis.type === 'cancel') {
        return {
          text: 'Tidak ada aksi yang sedang menunggu untuk dibatalkan.',
        }
      }

      return {
        text: analysis.reply || 'Maaf, permintaan tersebut kurang jelas.',
      }
    },
    [
      addTransaction,
      addWallet,
      analytics,
      budgets,
      contributeToGoal,
      createGoalWithContribution,
      formatRupiah,
      getSnapshot,
      goals,
      handleDeleteTransaction,
      learnFromInput,
      renameWallet,
      resolveTransactionCategory,
      syncFinancialViews,
      totalBalance,
      transactions,
      transferBetweenWallets,
      archivedWallets,
      walletOptions,
      wallets,
      withdrawFromGoal,
    ]
  )

  const processPendingAction = useCallback(
    async ({ text }) => {
      if (!pendingAction) {
        return null
      }

      if (pendingAction.type === 'delete_wallet') {
        if (isAffirmative(text)) {
          const deleteResult = await deleteWallet(pendingAction.walletId)

          if (deleteResult.error) {
            throw deleteResult.error
          }

          setPendingAction(null)
          await syncFinancialViews({
            wallets: true,
            analytics: true,
            names: true,
          })

          return {
            text: buildWalletDeletionSuccess(pendingAction.walletName),
          }
        }

        if (isNegative(text)) {
          setPendingAction(null)
          return {
            text: 'Baik, penghapusan dompet dibatalkan.',
          }
        }

        return {
          text: 'Ketik "Ya" untuk menghapus dompet atau "Batal" untuk membatalkannya.',
          intentStatus: 'needs_confirmation',
        }
      }

      if (pendingAction.type === 'restore_wallet') {
        if (isAffirmative(text)) {
          const restoreResult = await restoreWallet(pendingAction.walletId)

          if (restoreResult.error) {
            throw restoreResult.error
          }

          setPendingAction(null)
          await syncFinancialViews({
            wallets: true,
            analytics: true,
            names: true,
          })

          return {
            text: buildWalletRestoreSuccess(pendingAction.walletName),
          }
        }

        if (isNegative(text)) {
          setPendingAction(null)
          return {
            text: 'Baik, pemulihan dompet dibatalkan.',
          }
        }

        return {
          text: 'Ketik "Ya" untuk memulihkan dompet atau "Batal" untuk membatalkannya.',
          intentStatus: 'needs_confirmation',
        }
      }

      if (pendingAction.type === 'confirm_create_wallet') {
        if (isAffirmative(text)) {
          const createResult = await addWallet(pendingAction.walletName, 0, 'bank')

          if (createResult.error) {
            throw createResult.error
          }

          await syncFinancialViews({
            analytics: true,
            names: true,
          })

          setPendingAction(null)

          if (!pendingAction.intent) {
            return {
              text: `Dompet **${createResult.data.name}** berhasil dibuat.`,
            }
          }

          const resumedIntent = withWalletAttached(pendingAction.intent, createResult.data)
          const resumedResponse = await executeIntent(resumedIntent, {
            source: 'chat',
            walletCatalog: [...wallets, createResult.data],
          })

          return {
            ...resumedResponse,
            text: `Dompet **${createResult.data.name}** berhasil dibuat.\n\n${resumedResponse.text}`,
          }
        }

        if (isNegative(text)) {
          setPendingAction(null)
          return {
            text: 'Baik, dompet baru tidak jadi dibuat dan aksi sebelumnya dibatalkan.',
          }
        }

        const resolution = resolveOptionReference({
          input: text,
          options: walletOptions,
        })

        if (resolution.match) {
          setPendingAction(null)

          if (!pendingAction.intent) {
            return {
              text: `Baik, saya gunakan dompet **${resolution.match.name}** yang sudah ada.`,
            }
          }

          const resumedIntent = withWalletAttached(pendingAction.intent, resolution.match)
          const resumedResponse = await executeIntent(resumedIntent, { source: 'chat' })

          return {
            ...resumedResponse,
            text: `Baik, saya pakai dompet **${resolution.match.name}** yang sudah ada.\n\n${resumedResponse.text}`,
          }
        }

        if (resolution.candidates.length > 0) {
          return {
            text: `Nama dompetnya masih ambigu. Pilih salah satu: ${formatCandidateNames(resolution.candidates)}.`,
            intentStatus: 'needs_confirmation',
          }
        }

        return {
          text: 'Ketik "Ya", sebut dompet yang benar, atau "Batal".',
          intentStatus: 'needs_confirmation',
        }
      }

      if (pendingAction.type === 'resolve_intent') {
        if (isNegative(text)) {
          setPendingAction(null)
          return {
            text: 'Baik, aksi sebelumnya saya batalkan.',
          }
        }

        const resolution = resolveOptionReference({
          input: text,
          options: pendingAction.candidates?.length > 0 ? pendingAction.candidates : walletOptions,
        })

        if (resolution.match) {
          const resumedIntent = attachResolvedWallet(pendingAction.intent, resolution.match)
          setPendingAction(null)
          return executeIntent(resumedIntent, { source: 'chat' })
        }

        if (resolution.candidates.length > 0) {
          return {
            text: `Pilihan dompetnya masih ambigu. Pilih salah satu: ${formatCandidateNames(resolution.candidates)}.`,
            intentStatus: 'needs_confirmation',
          }
        }

        return {
          text: `Saya tidak menemukan dompet itu. Pilih salah satu: ${formatCandidateNames(pendingAction.candidates?.length > 0 ? pendingAction.candidates : walletOptions)}.`,
          intentStatus: 'needs_confirmation',
        }
      }

      if (pendingAction.type === 'create_goal_target') {
        if (isNegative(text)) {
          setPendingAction(null)
          return {
            text: 'Baik, pembuatan target tabungan saya batalkan.',
          }
        }

        const amountMatch = matchMoney(text)
        const targetAmount = parseMoneyMatch(amountMatch)

        if (!targetAmount || targetAmount <= 0) {
          return {
            text: 'Saya masih butuh nominal target totalnya. Contoh: 50jt atau 1000000.',
            intentStatus: 'needs_confirmation',
          }
        }

        const sourceWallet =
          pendingAction.initialAmount > 0
            ? wallets.find((wallet) => wallet.id === pendingAction.sourceWalletId) ||
              (wallets.length === 1 ? wallets[0] : null)
            : null

        if (pendingAction.initialAmount > 0 && !sourceWallet) {
          setPendingAction({
            type: 'create_goal_source_wallet',
            name: pendingAction.name,
            targetAmount,
            initialAmount: pendingAction.initialAmount,
          })

          return {
            text: `Setoran awal **${formatRupiah(pendingAction.initialAmount)}** mau diambil dari dompet mana? Pilihan aktif Anda: ${formatCandidateNames(walletOptions)}.`,
            intentStatus: 'needs_confirmation',
          }
        }

        const createGoalResult = await createGoalWithContribution({
          name: pendingAction.name,
          targetAmount,
          initialAmount: pendingAction.initialAmount,
          walletId: sourceWallet?.id || null,
        })

        if (createGoalResult.error) {
          throw createGoalResult.error
        }

        setPendingAction(null)
        await syncFinancialViews({
          wallets: createGoalResult.walletHandled,
          transactions: createGoalResult.walletHandled,
          analytics: true,
          names: true,
        })

        return {
          text:
            pendingAction.initialAmount > 0
              ? `Target **${pendingAction.name}** berhasil dibuat dengan target **${formatRupiah(targetAmount)}** dan setoran awal **${formatRupiah(pendingAction.initialAmount)}**.`
              : `Target **${pendingAction.name}** berhasil dibuat dengan target **${formatRupiah(targetAmount)}**.`,
        }
      }

      if (pendingAction.type === 'create_goal_source_wallet') {
        if (isNegative(text)) {
          setPendingAction(null)
          return {
            text: 'Baik, pembuatan target tabungan saya batalkan.',
          }
        }

        const resolution = resolveOptionReference({
          input: text,
          options: walletOptions,
        })

        if (resolution.match) {
          const createGoalResult = await createGoalWithContribution({
            name: pendingAction.name,
            targetAmount: pendingAction.targetAmount,
            initialAmount: pendingAction.initialAmount,
            walletId: resolution.match.id,
          })

          if (createGoalResult.error) {
            throw createGoalResult.error
          }

          setPendingAction(null)
          await syncFinancialViews({
            wallets: createGoalResult.walletHandled,
            transactions: createGoalResult.walletHandled,
            analytics: true,
            names: true,
          })

          return {
            text: `Target **${pendingAction.name}** berhasil dibuat. Setoran awal **${formatRupiah(pendingAction.initialAmount)}** diambil dari dompet **${resolution.match.name}**.`,
          }
        }

        if (resolution.candidates.length > 0) {
          return {
            text: `Nama dompetnya masih ambigu. Pilih salah satu: ${formatCandidateNames(resolution.candidates)}.`,
            intentStatus: 'needs_confirmation',
          }
        }

        return {
          text: `Saya tidak menemukan dompet itu. Pilih salah satu dompet aktif Anda: ${formatCandidateNames(walletOptions)}.`,
          intentStatus: 'needs_confirmation',
        }
      }

      setPendingAction(null)
      return {
        text: 'Aksi yang menunggu konfirmasi sudah dibatalkan.',
      }
    },
    [
      addWallet,
      createGoalWithContribution,
      deleteWallet,
      executeIntent,
      formatRupiah,
      pendingAction,
      restoreWallet,
      syncFinancialViews,
      walletOptions,
      wallets,
    ]
  )

  const handleSend = useCallback(
    async (payload) => {
      const text =
        typeof payload === 'string'
          ? payload
          : typeof payload?.text === 'string'
            ? payload.text
            : ''
      const imageFile = payload && typeof payload === 'object' ? payload.imageFile || null : null
      const imagePreview =
        payload && typeof payload === 'object'
          ? payload.imagePreview || payload.image || null
          : null

      if ((!text.trim() && !imageFile && !imagePreview) || isTyping) {
        return
      }

      const userMessageText = text.trim() || 'Lampiran gambar'

      try {
        const savedUserMessage = await saveMessage('user', userMessageText, {
          imageFile,
          imagePreview,
        })

        if (savedUserMessage?.error) {
          throw savedUserMessage.error
        }

        setIsTyping(true)

        let response

        if (pendingAction) {
          response = await processPendingAction({ text: userMessageText })
        } else {
          const financialContext = getAIContextString()

          const analysis = await analyzeTransaction(
            text,
            imagePreview,
            walletOptions,
            goalOptions,
            categoryOptions,
            financialContext,
            {
              categoryRules,
              archivedWalletOptions,
            }
          )

          response = await executeIntent(analysis, {
            source: imagePreview ? 'ocr' : 'chat',
            rawText: userMessageText,
          })
        }

        await persistBotResponse(response)
      } catch (error) {
        console.error('Chat Error:', error)
        await persistBotResponse({
          text: `Maaf, ${mapDomainError(error)}`,
        })
      } finally {
        setIsTyping(false)
      }
    },
    [
      categoryOptions,
      categoryRules,
      executeIntent,
      getAIContextString,
      goalOptions,
      isTyping,
      pendingAction,
      persistBotResponse,
      processPendingAction,
      saveMessage,
      archivedWalletOptions,
      walletOptions,
    ]
  )

  const handleExecuteStrategy = useCallback((prompt) => {
    setActiveTab('chat')
    handleSend(prompt)
  }, [handleSend])

  const handleAddGoal = useCallback(async (goalData) => {
    const result = await addGoal(goalData)

    if (!result.error) {
      await syncFinancialViews({
        names: true,
      })
      showNotice(`Target ${goalData.name} berhasil dibuat.`, 'success')
    }

    return result
  }, [addGoal, showNotice, syncFinancialViews])

  const handleDeleteGoal = useCallback(async (id) => {
    const targetGoal = goals.find((goal) => goal.id === id)
    const preferredWallet =
      wallets.find((wallet) => wallet.name.toLowerCase() === 'tunai') || wallets[0] || null
    const refundAmount = Number(targetGoal?.current_amount || 0)
    const refundTargetName = preferredWallet?.name || 'Tunai'
    const dialogCopy = getGoalDeletionDialogCopy(targetGoal, refundAmount, refundTargetName, formatRupiah)

    setActionDialog({
      type: 'delete_goal',
      goalId: id,
      goalName: targetGoal?.name || 'target ini',
      walletId: refundAmount > 0 ? preferredWallet?.id || null : null,
      ...dialogCopy,
    })

    return { error: null }
  }, [formatRupiah, goals, wallets])

  const handleAddWallet = useCallback(async (name, balance) => {
    const result = await addWallet(name, balance)

    if (!result.error) {
      await syncFinancialViews({
        transactions: result.ledgerCreated,
        analytics: true,
        names: true,
      })
      showNotice(`Dompet ${result.data.name} berhasil dibuat.`, 'success')
    }

    return result
  }, [addWallet, showNotice, syncFinancialViews])

  const handleDeleteWallet = useCallback(async (id) => {
    const targetWallet = wallets.find((wallet) => wallet.id === id)
    const dialogCopy = getWalletDeletionDialogCopy(targetWallet, formatRupiah)

    setActionDialog({
      type: 'delete_wallet',
      walletId: id,
      walletName: targetWallet?.name || 'dompet ini',
      ...dialogCopy,
    })

    return { error: null, mode: null }
  }, [formatRupiah, wallets])

  const closeActionDialog = useCallback(() => {
    if (dialogSubmitting) {
      return
    }

    setActionDialog(null)
  }, [dialogSubmitting])

  const handleActionDialogConfirm = useCallback(async () => {
    if (!actionDialog || dialogSubmitting) {
      return
    }

    setDialogSubmitting(true)

    try {
      if (actionDialog.type === 'delete_goal') {
        const result = await deleteGoal({
          goalId: actionDialog.goalId,
          walletId: actionDialog.walletId,
        })

        if (result.error) {
          showNotice(mapDomainError(result.error), 'error')
          return
        }

        await syncFinancialViews({
          wallets: result.walletHandled,
          transactions: result.ledgerHandled,
          analytics: true,
          names: true,
        })
        showNotice(`Target ${actionDialog.goalName} berhasil dihapus.`, 'success')
      }

      if (actionDialog.type === 'delete_wallet') {
        const result = await deleteWallet(actionDialog.walletId)

        if (result.error) {
          showNotice(mapDomainError(result.error), 'error')
          return
        }

        await syncFinancialViews({
          wallets: true,
          analytics: true,
          names: true,
        })
        showNotice(buildWalletDeletionNotice(actionDialog.walletName), 'success')
      }

      if (actionDialog.type === 'restore_wallet') {
        const result = await restoreWallet(actionDialog.walletId)

        if (result.error) {
          showNotice(mapDomainError(result.error), 'error')
          return
        }

        await syncFinancialViews({
          wallets: true,
          analytics: true,
          names: true,
        })
        showNotice(buildWalletRestoreNotice(actionDialog.walletName), 'success')
      }

      setActionDialog(null)
    } finally {
      setDialogSubmitting(false)
    }
  }, [actionDialog, deleteGoal, deleteWallet, dialogSubmitting, restoreWallet, showNotice, syncFinancialViews])

  const handleRenameWallet = useCallback(async (walletId, nextName) => {
    const result = await renameWallet(walletId, nextName)

    if (!result.error) {
      await syncFinancialViews({
        wallets: true,
        names: true,
      })
      showNotice(`Nama dompet berhasil diubah menjadi ${result.data.wallet_name}.`, 'success')
    }

    return result
  }, [renameWallet, showNotice, syncFinancialViews])

  const handleRenameGoal = useCallback(async (goalId, nextName) => {
    const result = await renameGoal(goalId, nextName)

    if (!result.error) {
      await syncFinancialViews({
        names: true,
      })
      showNotice(`Nama target berhasil diubah menjadi ${nextName}.`, 'success')
    }

    return result
  }, [renameGoal, showNotice, syncFinancialViews])

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-white font-inter text-midnight selection:bg-emerald-100 selection:text-midnight">
      <DesktopSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="mx-auto flex h-[100dvh] w-full max-w-6xl min-w-0 flex-col overflow-hidden bg-white md:max-w-none md:bg-champagne">
        <AppHeader
          balance={grandTotalBalance}
          formatRupiah={formatRupiah}
          onBalanceClick={() => setActiveTab('wallets')}
        />
        <DesktopHeader
          activeTab={activeTab}
          balance={grandTotalBalance}
          formatRupiah={formatRupiah}
        />

        <div className="flex min-h-0 flex-1 overflow-hidden md:gap-5 md:p-5 md:pt-0">
          <section
            className={`relative min-w-0 flex-1 overflow-hidden bg-white ${
              activeTab === 'chat'
                ? 'md:rounded-[20px] md:border md:border-midnight/[0.08] md:shadow-[0_8px_24px_rgba(15,23,42,0.035)]'
                : 'md:bg-transparent'
            }`}
          >
            {activeTab === 'chat' ? (
              <div className="absolute inset-0 h-full w-full">
              <ChatView
                messages={
                  messages.length > 0
                    ? messages
                    : [
                        {
                          ...WELCOME_MESSAGE,
                          time: getCurrentTimeLabel(),
                        },
                      ]
                }
                isTyping={isTyping}
                onSend={handleSend}
                onNotify={showNotice}
                formatRupiah={formatRupiah}
                hasMore={hasMoreMessages}
                loadingMore={loadingMoreMessages}
                onLoadMore={loadMoreMessages}
                onNavigate={setActiveTab}
              />
              </div>
            ) : null}

            {activeTab === 'history' ? (
              <div className="absolute inset-x-0 top-0 bottom-[92px] w-full overflow-y-auto no-scrollbar animate-fade-in md:bottom-0">
                <Suspense fallback={<ViewLoadingFallback />}>
                  <HistoryView
                    transactions={transactions}
                    formatRupiah={formatRupiah}
                    onDeleteTransaction={handleDeleteTransaction}
                    hasMore={hasMoreTransactions}
                    loadingMore={loadingMoreTransactions}
                    onLoadMore={loadMoreTransactions}
                  />
                </Suspense>
              </div>
            ) : null}

            {activeTab === 'wallets' ? (
              <div className="absolute inset-x-0 top-0 bottom-[92px] w-full overflow-y-auto no-scrollbar animate-fade-in md:bottom-0">
                <Suspense fallback={<ViewLoadingFallback />}>
                  <WalletsView
                    wallets={wallets}
                    goals={goals}
                    conflicts={conflicts}
                    onAddWallet={handleAddWallet}
                    onDeleteWallet={handleDeleteWallet}
                    onRenameWallet={handleRenameWallet}
                    onAddGoal={handleAddGoal}
                    onDeleteGoal={handleDeleteGoal}
                    onRenameGoal={handleRenameGoal}
                    formatRupiah={formatRupiah}
                  />
                </Suspense>
              </div>
            ) : null}

            {activeTab === 'analytics' ? (
              <div className="absolute inset-x-0 top-0 bottom-[92px] w-full overflow-y-auto no-scrollbar animate-fade-in md:bottom-0">
                <Suspense fallback={<ViewLoadingFallback />}>
                  <AnalyticsView
                    analytics={analytics}
                    budgets={budgets}
                    formatRupiah={formatRupiah}
                  />
                </Suspense>
              </div>
            ) : null}
          </section>

          <DesktopRightPanel
            analytics={analytics}
            transactions={transactions}
            onExecuteStrategy={handleExecuteStrategy}
          />
        </div>

        <BottomDock activeTab={activeTab} onTabChange={setActiveTab} />
      </main>

      {actionDialog ? (
        <ActionConfirmModal
          title={actionDialog.title}
          paragraphs={actionDialog.paragraphs}
          confirmLabel={actionDialog.confirmLabel}
          tone={actionDialog.tone}
          submitting={dialogSubmitting}
          onCancel={closeActionDialog}
          onConfirm={handleActionDialogConfirm}
        />
      ) : null}

      {notice ? (
        <StatusToast
          message={notice.message}
          tone={notice.tone}
          onClose={() => setNotice(null)}
        />
      ) : null}
    </div>
  )
}
