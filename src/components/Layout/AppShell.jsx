import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWallets } from '../../hooks/useWallets'
import { useTransactions } from '../../hooks/useTransactions'
import { useCategories } from '../../hooks/useCategories'
import { useGoals } from '../../hooks/useGoals'
import { useBudgets } from '../../hooks/useBudgets'
import { useInputLearning } from '../../hooks/useInputLearning'
import { useTransactionActions } from '../../hooks/useTransactionActions'
import BottomDock from './BottomDock'
import DesktopHeader from './DesktopHeader'
import DesktopRightPanel from './DesktopRightPanel'
import DesktopSidebar from './DesktopSidebar'
import AppHeader from './AppHeader'
import ActionConfirmModal from '../shared/ActionConfirmModal'
import StatusToast from '../shared/StatusToast'
import ChatView from '../Chat/ChatView'
import { useAdvisor } from '../../hooks/useAdvisor'
import { useChat } from '../../hooks/useChat'
import { useAnalytics } from '../../hooks/useAnalytics'
import { useDeterministicAssistant } from '../../hooks/useDeterministicAssistant'
import { useNameConflicts } from '../../hooks/useNameConflicts'
import { useLegacyIntentExecutor } from '../../hooks/useLegacyIntentExecutor'
import { resolveCategoryForMessage } from '../../lib/chatLearning'
import {
  buildWalletDeletionNotice,
  buildWalletDeletionSuccess,
  buildWalletRestoreNotice,
  buildWalletRestoreSuccess,
  getGoalDeletionDialogCopy,
  getWalletDeletionDialogCopy,
  mapDomainError,
} from '../../lib/domainMessages'
import {
  buildGoalOptions,
  buildWalletOptions,
  formatCandidateNames,
  matchMoney,
  parseMoneyMatch,
  resolveOptionReference,
} from '../../lib/chatEntities'
import { buildChatQuickActions } from '../../lib/chatSuggestions'
import { derivePendingFinanceDraft } from '../../lib/conversationalFinance'
import {
  attachResolvedWallet,
  getCurrentTimeLabel,
  getWelcomeMessage,
  isAffirmative,
  isDirectPendingAmountAnswer,
  isDirectPendingWalletChoice,
  isNegative,
  withWalletAttached,
} from '../../lib/appShellChatHelpers'

const loadLocalParser = () => import('../../lib/localAssistant')
const loadHistoryView = () => import('../History/HistoryView')
const loadEditTransactionModal = () => import('../History/EditTransactionModal')
const loadWalletsView = () => import('../Wallets/WalletsView')
const loadAnalyticsView = () => import('../Analytics/AnalyticsView')
const loadSettingsView = () => import('../Settings/SettingsView')
const HistoryView = lazy(loadHistoryView)
const EditTransactionModal = lazy(loadEditTransactionModal)
const WalletsView = lazy(loadWalletsView)
const AnalyticsView = lazy(loadAnalyticsView)
const SettingsView = lazy(loadSettingsView)
function ViewLoadingFallback() {
  return (
    <div className="h-full w-full p-4 sm:p-6">
      <div className="mx-auto w-full max-w-5xl animate-pulse space-y-4 md:max-w-none">
        <div className="h-8 w-44 rounded-[12px] bg-midnight/8" />
        <div className="grid gap-3 md:grid-cols-[1.4fr_0.6fr]">
          <div className="h-32 rounded-[16px] bg-midnight/[0.06]" />
          <div className="h-32 rounded-[16px] bg-midnight/[0.06]" />
        </div>
        <div className="h-[340px] rounded-[20px] bg-midnight/[0.05]" />
      </div>
    </div>
  )
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
    addTransactionsBatch,
    replaceTransaction,
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
    loading: chatLoading,
    error: chatError,
    saveMessage,
    hasMore: hasMoreMessages,
    loadingMore: loadingMoreMessages,
    loadMore: loadMoreMessages,
    refetch: refetchChat,
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

  const { grandTotalBalance } = advisor

  const [activeTab, setActiveTab] = useState('chat')
  const [isTyping, setIsTyping] = useState(false)
  const sendInFlightRef = useRef(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [actionDialog, setActionDialog] = useState(null)
  const [chatEditorTransaction, setChatEditorTransaction] = useState(null)
  const [dialogSubmitting, setDialogSubmitting] = useState(false)
  const [notice, setNotice] = useState(null)

  const walletOptions = useMemo(() => buildWalletOptions(wallets), [wallets])
  const archivedWalletOptions = useMemo(() => buildWalletOptions(archivedWallets), [archivedWallets])
  const goalOptions = useMemo(() => buildGoalOptions(goals), [goals])
  const chatQuickActions = useMemo(
    () =>
      buildChatQuickActions({
        wallets,
        archivedWallets,
        transactions,
        analytics,
      }),
    [analytics, archivedWallets, transactions, wallets]
  )
  const financeDraft = useMemo(() => derivePendingFinanceDraft(messages), [messages])

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

  const deterministicAssistant = useDeterministicAssistant({
    wallets,
    categories,
    budgets,
    goals,
    transactions,
    messages,
    totalBalance,
    syncFinancialViews,
  })

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
    if (typeof window === 'undefined' || !window.matchMedia('(min-width: 768px)').matches) {
      return undefined
    }

    const preloadViews = () => {
      loadHistoryView()
      loadEditTransactionModal()
      loadWalletsView()
      loadAnalyticsView()
      loadSettingsView()
    }

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(preloadViews, { timeout: 4000 })
      return () => window.cancelIdleCallback(idleId)
    }

    const timeoutId = window.setTimeout(preloadViews, 2500)
    return () => window.clearTimeout(timeoutId)
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

    const result = await saveMessage('bot', response.text, extras)
    if (result?.error) {
      throw result.error
    }
  }, [saveMessage])

  const {
    handleDeleteTransaction,
    handleUndoLastTransaction,
    handleUndoTransaction,
    handleUpdateTransaction,
    undoLatestManualTransaction,
    handleConfirmTransactionDialog,
  } = useTransactionActions({
    transactions,
    deleteTransaction,
    replaceTransaction,
    syncFinancialViews,
    showNotice,
    setActionDialog,
    formatRupiah,
  })

  const resolveTransactionCategory = useCallback(
    async ({ analysis, rawText, allowCreate = true }) => {
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

      if (allowCreate && !category && categoryResolution.createCategory) {
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

  const executeIntent = useLegacyIntentExecutor({
    addTransaction,
    addTransactionsBatch,
    addWallet,
    analytics,
    archivedWallets,
    budgets,
    contributeToGoal,
    createGoalWithContribution,
    formatRupiah,
    getSnapshot,
    goals,
    handleUpdateTransaction,
    learnFromInput,
    renameWallet,
    resolveCategory,
    resolveTransactionCategory,
    setPendingAction,
    syncFinancialViews,
    totalBalance,
    transactions,
    transferBetweenWallets,
    undoLatestManualTransaction,
    walletOptions,
    wallets,
    withdrawFromGoal,
  })

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

        const { assessPendingFinanceReply } = await loadLocalParser()
        const pendingReplyAssessment = assessPendingFinanceReply(text)
        if (!pendingReplyAssessment.safe) {
          return {
            text: `Saya belum menjalankan aksi sebelumnya. ${pendingReplyAssessment.reply}`,
            intentStatus: 'needs_confirmation',
          }
        }

        const resolution = resolveOptionReference({
          input: text,
          options: walletOptions,
        })

        if (resolution.match) {
          if (!isDirectPendingWalletChoice(text, resolution.match)) {
            return {
              text: `Untuk memilih dompet yang sudah ada, jawab langsung seperti "pakai ${resolution.match.name}".`,
              intentStatus: 'needs_confirmation',
            }
          }

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

        const { assessPendingFinanceReply } = await loadLocalParser()
        const pendingReplyAssessment = assessPendingFinanceReply(text)
        if (!pendingReplyAssessment.safe) {
          return {
            text: `Saya belum menjalankan aksi sebelumnya. ${pendingReplyAssessment.reply}`,
            intentStatus: 'needs_confirmation',
          }
        }

        const resolution = resolveOptionReference({
          input: text,
          options: pendingAction.candidates?.length > 0 ? pendingAction.candidates : walletOptions,
        })

        if (resolution.match) {
          if (!isDirectPendingWalletChoice(text, resolution.match)) {
            return {
              text: `Untuk melanjutkan, jawab hanya pilihan dompetnya, misalnya "pakai ${resolution.match.name}".`,
              intentStatus: 'needs_confirmation',
            }
          }

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

        const { assessPendingFinanceReply } = await loadLocalParser()
        const pendingReplyAssessment = assessPendingFinanceReply(text)
        if (!pendingReplyAssessment.safe) {
          return {
            text: `Target belum dibuat. ${pendingReplyAssessment.reply}`,
            intentStatus: 'needs_confirmation',
          }
        }

        const amountMatch = matchMoney(pendingReplyAssessment.normalizedText)
        const targetAmount = parseMoneyMatch(amountMatch)

        if (
          !targetAmount ||
          targetAmount <= 0 ||
          !isDirectPendingAmountAnswer(pendingReplyAssessment.normalizedText, amountMatch)
        ) {
          return {
            text: 'Saya masih butuh satu nominal target final. Jawab langsung, misalnya "targetnya 50jt".',
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

        const { assessPendingFinanceReply } = await loadLocalParser()
        const pendingReplyAssessment = assessPendingFinanceReply(text)
        if (!pendingReplyAssessment.safe) {
          return {
            text: `Target belum dibuat. ${pendingReplyAssessment.reply}`,
            intentStatus: 'needs_confirmation',
          }
        }

        const resolution = resolveOptionReference({
          input: text,
          options: walletOptions,
        })

        if (resolution.match) {
          if (!isDirectPendingWalletChoice(text, resolution.match)) {
            return {
              text: `Untuk memilih dompet sumber, jawab langsung seperti "pakai ${resolution.match.name}".`,
              intentStatus: 'needs_confirmation',
            }
          }

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

      if ((!text.trim() && !imageFile && !imagePreview) || sendInFlightRef.current || chatLoading) {
        return
      }

      const userMessageText = text.trim() || 'Lampiran gambar'
      sendInFlightRef.current = true
      setIsTyping(true)

      try {
        const savedUserMessage = await saveMessage('user', userMessageText, {
          imageFile,
          imagePreview,
        })

        if (savedUserMessage?.error) {
          throw savedUserMessage.error
        }

        const messageRequestId = savedUserMessage.data?.id || null

        let response

        const deterministicResult = await deterministicAssistant.processMessage({
          text: userMessageText,
          sourceMessageId: messageRequestId,
        })

        if (deterministicResult.handled) {
          response = deterministicResult.response
        } else if (pendingAction) {
          response = await processPendingAction({ text: userMessageText })
        } else {
          const { analyzeTransaction } = await loadLocalParser()
          const analysis = await analyzeTransaction(
            text,
            imagePreview,
            walletOptions,
            goalOptions,
            categoryOptions,
            '',
            {
              categoryRules,
              archivedWalletOptions,
              financeDraft,
              financialState: {
                totalBalance,
                budgets,
              },
            }
          )

          response = await executeIntent(analysis, {
            source: 'chat',
            rawText: userMessageText,
            requestId: messageRequestId,
          })
        }

        await persistBotResponse(response)
      } catch (error) {
        console.error('Chat Error:', error)
        try {
          await persistBotResponse({
            text: `Maaf, ${mapDomainError(error)}`,
          })
        } catch {
          showNotice('Pesan gagal diproses dan balasan belum tersimpan. Coba lagi.', 'error')
        }
      } finally {
        sendInFlightRef.current = false
        setIsTyping(false)
      }
    },
    [
      categoryOptions,
      categoryRules,
      budgets,
      chatLoading,
      deterministicAssistant,
      executeIntent,
      financeDraft,
      goalOptions,
      pendingAction,
      persistBotResponse,
      processPendingAction,
      saveMessage,
      showNotice,
      archivedWalletOptions,
      totalBalance,
      walletOptions,
    ]
  )

  const handleChatCardAction = useCallback((action, card = {}) => {
    if (action === 'assistant-confirm') {
      handleSend('Iya catat')
      return
    }

    if (action === 'assistant-cancel') {
      handleSend('Batal')
      return
    }

    if (action === 'assistant-edit') {
      handleSend('Ubah rincian aksi ini')
      return
    }

    if (action === 'history') {
      setActiveTab('history')
      return
    }

    if (action === 'undo') {
      if (card.transactionId) {
        handleUndoTransaction(card.transactionId)
        return
      }

      handleUndoLastTransaction()
      return
    }

    if (action === 'edit') {
      const targetTransaction = transactions.find((transaction) => transaction.id === card.transactionId)

      if (targetTransaction?.canEdit) {
        setChatEditorTransaction(targetTransaction)
        return
      }

      setActiveTab('history')
      showNotice('Transaksi ini bisa dikoreksi dari Histori.', 'info')
    }
  }, [handleSend, handleUndoLastTransaction, handleUndoTransaction, showNotice, transactions])

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
      if (actionDialog.type === 'delete_transaction' || actionDialog.type === 'undo_transaction') {
        const result = await handleConfirmTransactionDialog(actionDialog)

        if (result.error) {
          return
        }
      }

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
  }, [actionDialog, deleteGoal, deleteWallet, dialogSubmitting, handleConfirmTransactionDialog, restoreWallet, showNotice, syncFinancialViews])

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
    <div className="app-shell app-viewport flex overflow-hidden font-inter text-midnight selection:bg-orange-100 selection:text-midnight">
      <DesktopSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="app-viewport mx-auto flex min-w-0 flex-1 flex-col overflow-hidden">
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

        <div className="app-content-frame flex min-h-0 flex-1 gap-4 overflow-hidden lg:px-7 lg:pb-7">
          <section
            className={`relative min-w-0 flex-1 overflow-hidden ${
              activeTab === 'chat'
                ? 'chat-surface bg-white'
                : 'lg:rounded-[22px] lg:bg-transparent'
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
                          ...getWelcomeMessage({
                            balance: grandTotalBalance,
                            transactionCount: transactions.length,
                          }),
                          time: getCurrentTimeLabel(),
                        },
                      ]
                }
                isTyping={isTyping || chatLoading}
                onSend={handleSend}
                onNotify={showNotice}
                formatRupiah={formatRupiah}
                quickActions={chatQuickActions}
                goals={goals}
                balance={grandTotalBalance}
                hasMore={hasMoreMessages}
                loadingMore={loadingMoreMessages}
                onLoadMore={loadMoreMessages}
                onNavigate={setActiveTab}
                onCardAction={handleChatCardAction}
                isFreshChat={messages.length === 0}
                error={chatError}
                onRetry={refetchChat}
              />
              </div>
            ) : null}

            {activeTab === 'history' ? (
              <div className="mobile-content-inset absolute inset-x-0 top-0 w-full overflow-y-auto no-scrollbar animate-fade-in lg:bottom-0">
                <Suspense fallback={<ViewLoadingFallback />}>
                  <HistoryView
                    transactions={transactions}
                    wallets={wallets}
                    categories={categories}
                    formatRupiah={formatRupiah}
                    onDeleteTransaction={handleDeleteTransaction}
                    onUpdateTransaction={handleUpdateTransaction}
                    onUndoLastTransaction={handleUndoLastTransaction}
                    onNavigate={setActiveTab}
                    hasMore={hasMoreTransactions}
                    loadingMore={loadingMoreTransactions}
                    onLoadMore={loadMoreTransactions}
                  />
                </Suspense>
              </div>
            ) : null}

            {activeTab === 'wallets' ? (
              <div className="mobile-content-inset absolute inset-x-0 top-0 w-full overflow-y-auto no-scrollbar animate-fade-in lg:bottom-0">
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
              <div className="mobile-content-inset absolute inset-x-0 top-0 w-full overflow-y-auto no-scrollbar animate-fade-in lg:bottom-0">
                <Suspense fallback={<ViewLoadingFallback />}>
                  <AnalyticsView
                    analytics={analytics}
                    budgets={budgets}
                    formatRupiah={formatRupiah}
                  />
                </Suspense>
              </div>
            ) : null}

            {activeTab === 'settings' ? (
              <div className="mobile-content-inset absolute inset-x-0 top-0 w-full overflow-hidden animate-fade-in lg:bottom-0">
                <Suspense fallback={<ViewLoadingFallback />}>
                  <SettingsView />
                </Suspense>
              </div>
            ) : null}
          </section>

          {activeTab === 'chat' ? (
            <DesktopRightPanel
              analytics={analytics}
              transactions={transactions}
              goals={goals}
              onExecuteStrategy={handleSend}
            />
          ) : null}
        </div>

        <BottomDock activeTab={activeTab} onTabChange={setActiveTab} />
      </main>

      {chatEditorTransaction ? (
        <Suspense fallback={null}>
          <EditTransactionModal
            transaction={chatEditorTransaction}
            wallets={wallets}
            categories={categories}
            formatRupiah={formatRupiah}
            onClose={() => setChatEditorTransaction(null)}
            onSubmit={handleUpdateTransaction}
          />
        </Suspense>
      ) : null}

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
