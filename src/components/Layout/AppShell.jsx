import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { CHAT_SYNC_STATUS } from '../../lib/chat/chatSyncState'
import { useAdvisor } from '../../hooks/useAdvisor'
import { useChat } from '../../hooks/useChat'
import { useAnalytics } from '../../hooks/useAnalytics'
import { useDeterministicAssistant } from '../../hooks/useDeterministicAssistant'
import { useNameConflicts } from '../../hooks/useNameConflicts'
import {
  buildWalletDeletionNotice,
  buildWalletRestoreNotice,
  getGoalDeletionDialogCopy,
  getWalletDeletionDialogCopy,
  mapDomainError,
} from '../../lib/domainMessages'
import { buildChatQuickActions } from '../../lib/chatSuggestions'
import {
  attachAssistantUnderstanding,
  orchestrateAssistantMessage,
} from '../../lib/assistant/unifiedAssistantOrchestrator'
import { ASSISTANT_DECISION_HANDLERS } from '../../lib/assistant/assistantDecisionPolicy'
import {
  buildMemoryProposalResolutionResponse,
  buildMemoryProposalResponse,
  classifyMemoryProposalReply,
  getPendingMemoryProposal,
} from '../../lib/assistant/memoryProposal'
import { lazyWithRecovery } from '../../lib/lazyWithRecovery'
import { getCurrentTimeLabel, getWelcomeMessage } from '../../lib/appShellChatHelpers'

const loadHistoryView = () => import('../History/HistoryView')
const loadEditTransactionModal = () => import('../History/EditTransactionModal')
const loadWalletsView = () => import('../Wallets/WalletsView')
const loadAnalyticsView = () => import('../Analytics/AnalyticsView')
const loadSettingsView = () => import('../Settings/SettingsView')
const HistoryView = lazyWithRecovery(loadHistoryView, 'history')
const EditTransactionModal = lazyWithRecovery(loadEditTransactionModal, 'edit-transaction')
const WalletsView = lazyWithRecovery(loadWalletsView, 'wallets')
const AnalyticsView = lazyWithRecovery(loadAnalyticsView, 'analytics')
const SettingsView = lazyWithRecovery(loadSettingsView, 'settings')
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
    replaceTransaction,
    deleteTransaction,
    hasMore: hasMoreTransactions,
    loadingMore: loadingMoreTransactions,
    loadMore: loadMoreTransactions,
    refetch: refetchTransactions,
  } = useTransactions()

  const { categories } = useCategories()
  const {
    goals,
    addGoal,
    deleteGoal,
    renameGoal,
    refetch: refetchGoals,
  } = useGoals()
  const { budgets } = useBudgets()
  const {
    categoryRules,
    walletRules,
    learnFromInput,
    forgetRule,
  } = useInputLearning()
  const {
    messages,
    loading: chatLoading,
    error: chatError,
    syncStatus: chatSyncStatus,
    saveMessage,
    hasMore: hasMoreMessages,
    loadingMore: loadingMoreMessages,
    loadMore: loadMoreMessages,
    refetch: refetchChat,
  } = useChat()
  const { analytics, refetch: refetchAnalytics } = useAnalytics()
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
  const [actionDialog, setActionDialog] = useState(null)
  const [chatEditorTransaction, setChatEditorTransaction] = useState(null)
  const [dialogSubmitting, setDialogSubmitting] = useState(false)
  const [notice, setNotice] = useState(null)

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
    archivedWallets,
    categories,
    budgets,
    goals,
    transactions,
    messages,
    totalBalance,
    syncFinancialViews,
    categoryRules,
    walletRules,
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

  const processLearningRule = useCallback(async (candidate, rawText) => {
    if (!candidate || candidate.type === 'unknown') {
      return {
        text: candidate?.reply || 'Aku belum menyimpan aturan itu karena instruksinya belum cukup jelas.',
        metadata: {
          conversationStatus: 'learning_rule_rejected',
          learningRuleReason: candidate?.reason || 'missing_learning_candidate',
        },
      }
    }

    if (candidate.type === 'forget_learning_rule') {
      const result = await forgetRule({
        keyword: candidate.keyword,
        ruleType: candidate.ruleType,
      })
      if (result.error) throw result.error
      const deletedCount =
        Number(result.data?.categoryRulesDeleted || 0) +
        Number(result.data?.walletRulesDeleted || 0)
      return {
        text: deletedCount > 0
          ? `Aturan untuk **${candidate.keyword}** sudah dilupakan.`
          : `Tidak ada aturan aktif untuk **${candidate.keyword}**.`,
        metadata: {
          conversationStatus: 'learning_rule_forgotten',
          learningRuleType: candidate.ruleType,
        },
      }
    }

    const isCategory = candidate.type === 'teach_category_rule'
    const result = await learnFromInput({
      rawText,
      categoryId: isCategory ? candidate.categoryId : null,
      walletId: isCategory ? null : candidate.walletId,
      categoryKeywords: isCategory ? [candidate.keyword] : [],
      walletKeywords: isCategory ? [] : [candidate.keyword],
    })
    if (result.error) throw result.error
    return {
      text: isCategory
        ? `Siap, **${candidate.keyword}** sekarang kupahami sebagai kategori **${candidate.targetName}**.`
        : `Siap, kalau kamu bilang **${candidate.keyword}**, aku akan memakai dompet **${candidate.targetName}**.`,
      metadata: {
        conversationStatus: 'learning_rule_saved',
        learningRuleType: isCategory ? 'category' : 'wallet',
        learningRuleKeyword: candidate.keyword,
      },
    }
  }, [forgetRule, learnFromInput])
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

      if (
        (!text.trim() && !imageFile && !imagePreview) ||
        sendInFlightRef.current
      ) {
        return false
      }

      const userMessageText = text.trim() || 'Lampiran gambar'
      sendInFlightRef.current = true
      setIsTyping(true)
      let userMessageSaved = false

      try {
        const assistantReady = await deterministicAssistant.ensureReady()
        if (assistantReady?.error) {
          showNotice('Asisten belum tersambung. Coba kirim lagi sebentar lagi.', 'error')
          return false
        }

        const savedUserMessage = await saveMessage('user', userMessageText, {
          imageFile,
          imagePreview,
        })

        if (savedUserMessage?.error) {
          throw savedUserMessage.error
        }
        userMessageSaved = true

        const messageRequestId = savedUserMessage.data?.id || null
        const assistantSnapshot = deterministicAssistant.getSnapshot()
        const pendingMemoryProposal =
          !assistantSnapshot.pendingAction
            ? getPendingMemoryProposal(messages)
            : null
        const memoryProposalDecision = pendingMemoryProposal
          ? classifyMemoryProposalReply(userMessageText)
          : null
        const orchestration = orchestrateAssistantMessage({
          text: userMessageText,
          messages,
          wallets,
          archivedWallets,
          categories,
          goals,
          memory: assistantSnapshot.memories,
          categoryRules,
          walletRules,
          dialogueState: assistantSnapshot.dialogueState,
          pendingAction: assistantSnapshot.pendingAction,
          pendingMemoryProposal,
          memoryProposalDecision,
          financialState: {
            totalBalance,
            budgets,
          },
        })
        const assistantInputText = orchestration.resolvedText
        const handler = orchestration.decision.handler
        let actualEngine = handler

        let response

        if (
          handler === ASSISTANT_DECISION_HANDLERS.MEMORY_CONFIRMATION &&
          memoryProposalDecision === 'confirm'
        ) {
          await deterministicAssistant.confirmMemoryProposal({
            proposal: pendingMemoryProposal,
            sourceMessageId: messageRequestId,
          })
          actualEngine = 'memory-lifecycle'
          response = buildMemoryProposalResolutionResponse(
            pendingMemoryProposal,
            'confirm'
          )
        } else if (
          handler === ASSISTANT_DECISION_HANDLERS.MEMORY_CONFIRMATION &&
          memoryProposalDecision === 'cancel'
        ) {
          actualEngine = 'memory-lifecycle'
          response = buildMemoryProposalResolutionResponse(
            pendingMemoryProposal,
            'cancel'
          )
        } else if (handler === ASSISTANT_DECISION_HANDLERS.MEMORY_PROPOSAL) {
          const proposalResult =
            deterministicAssistant.proposeMemoryCandidates({
              candidates: orchestration.memoryCandidates,
              sourceMessageId: messageRequestId,
            })
          if (proposalResult.data) {
            actualEngine = 'memory-lifecycle'
            response = buildMemoryProposalResponse(proposalResult.data)
          } else {
            actualEngine = 'memory-lifecycle'
            response = {
              text: 'Saya belum menyimpan preferensi itu karena buktinya belum cukup aman. Tidak ada data yang diubah.',
              metadata: {
                conversationStatus: 'memory_proposal_rejected',
              },
            }
          }
        } else if (handler === ASSISTANT_DECISION_HANDLERS.LEARNING_RULE) {
          actualEngine = 'canonical-learning-rule'
          response = await processLearningRule(
            orchestration.learningRuleCandidate,
            userMessageText
          )
        } else {
          const deterministicResult = await deterministicAssistant.processMessage({
            text: assistantInputText,
            sourceMessageId: messageRequestId,
            semanticFrame: orchestration.frame,
          })

          if (deterministicResult.handled) {
            actualEngine = 'canonical-pipeline'
            response = deterministicResult.response
          } else {
            actualEngine = 'canonical-pipeline'
            response = {
              text: 'Maaf, permintaan ini belum dapat diproses melalui jalur yang aman. Tidak ada data yang diubah.',
              metadata: {
                conversationStatus: 'pipeline_invariant_blocked',
                assistantDecisionReason: orchestration.decision.reason,
              },
            }
          }
        }

        orchestration.actualEngine = actualEngine
        orchestration.frame = {
          ...orchestration.frame,
          engine: actualEngine,
          decision: orchestration.decision,
        }
        await persistBotResponse(
          attachAssistantUnderstanding(response, orchestration, {
            actualEngine,
          })
        )
        return true
      } catch (error) {
        console.error('Chat Error:', error)
        try {
          await persistBotResponse({
            text: `Maaf, ${mapDomainError(error)}`,
          })
        } catch {
          showNotice('Pesan gagal diproses dan balasan belum tersimpan. Coba lagi.', 'error')
        }
        return userMessageSaved
      } finally {
        sendInFlightRef.current = false
        setIsTyping(false)
      }
    },
    [
      archivedWallets,
      categoryRules,
      categories,
      budgets,
      deterministicAssistant,
      goals,
      messages,
      persistBotResponse,
      processLearningRule,
      saveMessage,
      showNotice,
      totalBalance,
      walletRules,
      wallets,
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
                    : chatSyncStatus === CHAT_SYNC_STATUS.READY
                      ? [
                        {
                          ...getWelcomeMessage({
                            balance: grandTotalBalance,
                            transactionCount: transactions.length,
                          }),
                          time: getCurrentTimeLabel(),
                        },
                      ]
                      : []
                }
                isTyping={isTyping}
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
                isFreshChat={messages.length === 0 && chatSyncStatus === CHAT_SYNC_STATUS.READY}
                error={chatError}
                onRetry={refetchChat}
                loading={chatLoading}
                syncStatus={chatSyncStatus}
                activePendingActionId={deterministicAssistant.pendingAction?.id || null}
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
