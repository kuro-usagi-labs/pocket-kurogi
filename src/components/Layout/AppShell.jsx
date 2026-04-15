import { useState, useCallback } from 'react'
import { Sparkles } from 'lucide-react'
import { useWallets } from '../../hooks/useWallets'
import { useTransactions } from '../../hooks/useTransactions'
import { useCategories } from '../../hooks/useCategories'
import { useGoals } from '../../hooks/useGoals'
import { useBudgets } from '../../hooks/useBudgets'
import { useInputLearning } from '../../hooks/useInputLearning'
import { analyzeTransaction } from '../../lib/gemini'
import BottomDock from './BottomDock'
import ChatView from '../Chat/ChatView'
import HistoryView from '../History/HistoryView'
import WalletsView from '../Wallets/WalletsView'
import AnalyticsView from '../Analytics/AnalyticsView'
import DesktopSidebar from './DesktopSidebar'
import DesktopHeader from './DesktopHeader'
import DesktopRightPanel from './DesktopRightPanel'
import { useAdvisor } from '../../hooks/useAdvisor'
import { useChat } from '../../hooks/useChat'
import { useAnalytics } from '../../hooks/useAnalytics'
import { buildAdviceReply, buildAnalyticsReply, resolveAnalyticsTimeframe } from '../../lib/analyticsChat'
import {
  buildWalletClarificationReply,
  resolveTransactionWithLearning,
  resolveWalletForMessage,
  resolveWalletSelection,
} from '../../lib/chatLearning'

export default function AppShell() {
  const {
    wallets,
    totalBalance,
    addWallet,
    deleteWallet,
    clearAllWallets,
    refetch: refetchWallets,
  } = useWallets()

  const {
    transactions,
    addTransaction,
    deleteTransaction,
    clearTransactionsInRange,
    clearAllTransactions,
    transferBetweenWallets,
    refetch: refetchTransactions,
  } = useTransactions()

  const { categories, findCategory } = useCategories()
  const {
    goals,
    addGoal,
    contributeToGoal,
    withdrawFromGoal,
    createGoalWithContribution,
    deleteGoal,
  } = useGoals()
  const { budgets } = useBudgets()
  const { categoryRules, walletRules, learnFromInput } = useInputLearning()
  const { messages, saveMessage } = useChat()
  const { analytics, getSnapshot, refetch: refetchAnalytics } = useAnalytics()

  const advisor = useAdvisor({
    wallets,
    totalBalance,
    transactions,
    analytics,
    goals,
    budgets,
  })

  const { getContextString, grandTotalBalance } = advisor

  const [activeTab, setActiveTab] = useState('chat')
  const [isTyping, setIsTyping] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)

  const formatRupiah = useCallback((number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(number)
  }, [])

  const syncFinancialViews = useCallback(
    async ({ wallets: shouldRefreshWallets = false, transactions: shouldRefreshTransactions = false, analytics: shouldRefreshAnalytics = true } = {}) => {
      const tasks = []

      if (shouldRefreshWallets) {
        tasks.push(refetchWallets())
      }

      if (shouldRefreshTransactions) {
        tasks.push(refetchTransactions())
      }

      if (shouldRefreshAnalytics) {
        tasks.push(refetchAnalytics())
      }

      if (tasks.length > 0) {
        await Promise.all(tasks)
      }
    },
    [refetchAnalytics, refetchTransactions, refetchWallets]
  )

  const recordTransactionDraft = useCallback(
    async ({ draft, rawText, image = null, forcedWallet = null }) => {
      const resolvedCategory =
        draft.categoryResolution?.category ||
        findCategory(draft.category) ||
        null

      let finalWallet = forcedWallet || draft.walletResolution?.wallet || null
      let isNewWallet = false

      if (
        !finalWallet &&
        draft.walletResolution?.resolution === 'explicit_missing' &&
        draft.walletResolution?.missingName
      ) {
        const walletCreation = await addWallet(draft.walletResolution.missingName, 0, 'bank')

        if (walletCreation.error) {
          throw walletCreation.error
        }

        finalWallet = walletCreation.data || null
        isNewWallet = Boolean(finalWallet)
      }

      if (!finalWallet) {
        throw new Error('Dompet tidak ditemukan.')
      }

      const { error: transactionError } = await addTransaction({
        type: draft.transactionType,
        amount: draft.amount,
        desc: draft.desc,
        notes: rawText,
        walletId: finalWallet.id,
        categoryId: resolvedCategory?.id || null,
        source: image ? 'ocr' : 'chat',
      })

      if (transactionError) {
        throw transactionError
      }

      learnFromInput({
        rawText,
        walletId: finalWallet.id,
        categoryId: resolvedCategory?.id || null,
      }).catch(() => null)

      await syncFinancialViews({
        wallets: true,
        analytics: true,
      })

      return {
        wallet: finalWallet,
        category: resolvedCategory,
        isNewWallet,
      }
    },
    [addTransaction, addWallet, findCategory, learnFromInput, syncFinancialViews]
  )

  const handleSend = useCallback(
    async (payload) => {
      let text = ''
      let image = null

      if (typeof payload === 'string') {
        text = payload
      } else if (payload && typeof payload === 'object') {
        text = payload.text || ''
        image = payload.image || null
      }

      if ((!text && !image) || isTyping) return

      const currentTime = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      })

      const userMessageText = text || 'Lampiran gambar'
      await saveMessage('user', userMessageText, image ? { image } : {})
      setIsTyping(true)

      try {
        let botResponse

        if (pendingAction) {
          let shouldClearPendingAction = true

          if (pendingAction.type === 'clarify_transaction_wallet') {
            if (isNegativeReply(text)) {
              botResponse = {
                sender: 'bot',
                text: 'Baik, pencatatan saya batalkan dulu. Kalau mau, kirim lagi dengan nama dompet yang diinginkan.',
                time: currentTime,
              }
            } else {
              const selectedWallet = resolveWalletSelection(text, wallets)

              if (!selectedWallet) {
                shouldClearPendingAction = false
                botResponse = {
                  sender: 'bot',
                  text: buildWalletClarificationReply({
                    draft: pendingAction.payload.draft,
                    wallets,
                    formatRupiah,
                  }),
                  time: currentTime,
                }
              } else {
                const transactionResult = await recordTransactionDraft({
                  draft: pendingAction.payload.draft,
                  rawText: pendingAction.payload.rawText,
                  image: pendingAction.payload.image,
                  forcedWallet: selectedWallet,
                })

                botResponse = {
                  sender: 'bot',
                  text:
                    (pendingAction.payload.draft.transactionType === 'income'
                      ? `Pemasukan divalidasi. Dana sebesar ${formatRupiah(pendingAction.payload.draft.amount)} dialokasikan ke ${selectedWallet.name.toUpperCase()}.`
                      : `Alokasi dana diproses. ${formatRupiah(pendingAction.payload.draft.amount)} ditarik dari ${selectedWallet.name.toUpperCase()}.`) +
                    (transactionResult.isNewWallet
                      ? `\n\n*(Catatan: Dompet ${selectedWallet.name.toUpperCase()} baru saja dibuat otomatis)*`
                      : ''),
                  time: currentTime,
                  card: {
                    type: pendingAction.payload.draft.transactionType,
                    amount: pendingAction.payload.draft.amount,
                    category: transactionResult.category?.name || pendingAction.payload.draft.category || 'Lainnya',
                    wallet: selectedWallet.name,
                    desc: pendingAction.payload.draft.desc,
                  },
                }
              }
            }
          } else if (pendingAction.type === 'clarify_goal_contribution_wallet') {
            if (isNegativeReply(text)) {
              botResponse = {
                sender: 'bot',
                text: 'Baik, setoran target saya batalkan dulu.',
                time: currentTime,
              }
            } else {
              const selectedWallet = resolveWalletSelection(text, wallets)

              if (!selectedWallet) {
                shouldClearPendingAction = false
                botResponse = {
                  sender: 'bot',
                  text: `Mau saya ambil ${formatRupiah(pendingAction.payload.amount)} dari dompet yang mana?\n\nPilih salah satu: ${wallets.map((wallet) => wallet.name).slice(0, 4).join(', ')}.`,
                  time: currentTime,
                }
              } else {
                const rpcContributionResult = await contributeToGoal({
                  goalId: pendingAction.payload.goalId,
                  amount: pendingAction.payload.amount,
                  walletId: selectedWallet.id,
                })

                if (rpcContributionResult.error) {
                  throw rpcContributionResult.error
                }

                await syncFinancialViews({
                  wallets: rpcContributionResult.walletHandled,
                  transactions: true,
                  analytics: true,
                })

                learnFromInput({
                  rawText: pendingAction.payload.rawText,
                  walletId: selectedWallet.id,
                  categoryId: null,
                }).catch(() => null)

                botResponse = {
                  sender: 'bot',
                  text:
                    pendingAction.payload.reply ||
                    `Berhasil menambahkan ${formatRupiah(pendingAction.payload.amount)} ke target Anda dari dompet ${selectedWallet.name}.`,
                  time: currentTime,
                }
              }
            }
          } else if (pendingAction.type === 'create_goal') {
            if (isNegativeReply(text)) {
              botResponse = {
                sender: 'bot',
                text: 'Baik, pembuatan target saya batalkan dulu.',
                time: currentTime,
              }
            } else {
              const amountMatch = text.match(/(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta|m)?/i)

              if (amountMatch) {
                let targetMatch = parseFloat(amountMatch[1].replace(',', '.'))
                const multiplier = amountMatch[2]
                if (['k', 'rb', 'ribu'].includes(multiplier)) targetMatch *= 1000
                if (['jt', 'juta'].includes(multiplier)) targetMatch *= 1000000
                if (multiplier === 'm') targetMatch *= 1000000000

                const sourceWallet =
                  wallets.find((wallet) => wallet.name.toLowerCase() === 'tunai') || wallets[0]

                const rpcGoalResult = await createGoalWithContribution({
                  name: pendingAction.payload.name,
                  targetAmount: targetMatch,
                  initialAmount: pendingAction.payload.amount,
                  walletId: pendingAction.payload.amount > 0 ? sourceWallet?.id || null : null,
                })

                if (rpcGoalResult.error) {
                  throw rpcGoalResult.error
                }

                const newGoalName = rpcGoalResult.data?.goal_name || pendingAction.payload.name
                await syncFinancialViews({
                  wallets: rpcGoalResult.walletHandled,
                  transactions: rpcGoalResult.walletHandled,
                  analytics: rpcGoalResult.walletHandled,
                })

                botResponse = {
                  sender: 'bot',
                  text: `Sip! Tabungan ${newGoalName} berhasil dibuat dengan target ${formatRupiah(targetMatch)}. Setoran awal ${formatRupiah(pendingAction.payload.amount)} sudah dimasukkan.`,
                  time: currentTime,
                }
              } else {
                shouldClearPendingAction = false
                botResponse = {
                  sender: 'bot',
                  text: 'Berapa target nominalnya? (Contoh: 50jt atau 1000000)',
                  time: currentTime,
                }
              }
            }
          } else if (isAffirmativeReply(text)) {
            const { type, payload: pendingPayload } = pendingAction

            if (type === 'delete_wallet') {
              const { error } = await deleteWallet(pendingPayload.id)
              if (error) throw error
              await syncFinancialViews({
                analytics: true,
              })
            } else if (type === 'bulk_delete_wallets') {
              const { error } = await clearAllWallets()
              if (error) throw error
              await syncFinancialViews({
                transactions: true,
                analytics: true,
              })
            } else if (type === 'bulk_delete_transactions') {
              const { error } =
                pendingPayload.startDate && pendingPayload.endDate
                  ? await clearTransactionsInRange(pendingPayload.startDate, pendingPayload.endDate)
                  : await clearAllTransactions()
              if (error) throw error
              await syncFinancialViews({
                transactions: true,
                analytics: true,
              })
            }

            botResponse = {
              sender: 'bot',
              text: `Selesai. ${pendingAction.successMessage}`,
              time: currentTime,
            }
          } else {
            botResponse = {
              sender: 'bot',
              text: 'Baik, operasi dibatalkan. Data Anda aman.',
              time: currentTime,
            }
          }

          if (shouldClearPendingAction) {
            setPendingAction(null)
          }
        } else {
          const walletNames = wallets.map((wallet) => wallet.name)
          const goalNames = goals.map((goal) => goal.name)
          const goalMap = goals.map((goal) => `${goal.name} (id: ${goal.id})`).join(', ')
          const financialContext = `${getContextString()}\nACTIVE GOALS FOR MAPPING: ${goalMap || 'Tidak ada goal aktif'}`
          const analysis = await analyzeTransaction(text, image, walletNames, financialContext, goalNames)
          const resolvedTransaction =
            analysis.type === 'transaction' || analysis.type === 'unknown'
              ? resolveTransactionWithLearning({
                  text,
                  analysis,
                  wallets,
                  categories,
                  walletRules,
                  categoryRules,
                })
              : null

          if (resolvedTransaction) {
            if (resolvedTransaction.walletResolution?.resolution === 'needs_clarification') {
              setPendingAction({
                type: 'clarify_transaction_wallet',
                payload: {
                  draft: resolvedTransaction,
                  rawText: text,
                  image,
                },
              })

              botResponse = {
                sender: 'bot',
                text: buildWalletClarificationReply({
                  draft: resolvedTransaction,
                  wallets,
                  formatRupiah,
                }),
                time: currentTime,
              }
            } else {
              const transactionResult = await recordTransactionDraft({
                draft: resolvedTransaction,
                rawText: text,
                image,
              })

              const walletDisplayName = (transactionResult.wallet?.name || resolvedTransaction.wallet || 'Dompet').toUpperCase()
              botResponse = {
                sender: 'bot',
                text:
                  (resolvedTransaction.transactionType === 'income'
                    ? `Pemasukan divalidasi. Dana sebesar ${formatRupiah(resolvedTransaction.amount)} dialokasikan ke ${walletDisplayName}.`
                    : `Alokasi dana diproses. ${formatRupiah(resolvedTransaction.amount)} ditarik dari ${walletDisplayName}.`) +
                  (transactionResult.isNewWallet
                    ? `\n\n*(Catatan: Dompet ${walletDisplayName} baru saja dibuat otomatis)*`
                    : ''),
                time: currentTime,
                card: {
                  type: resolvedTransaction.transactionType,
                  amount: resolvedTransaction.amount,
                  category: transactionResult.category?.name || resolvedTransaction.category || 'Lainnya',
                  wallet: transactionResult.wallet?.name || resolvedTransaction.wallet || 'Tunai',
                  desc: resolvedTransaction.desc,
                },
              }
            }
          } else if (analysis.type === 'analytics_query') {
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

          botResponse = {
            sender: 'bot',
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
            time: currentTime,
          }
          } else if (analysis.type === 'advice') {
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

          botResponse = {
            sender: 'bot',
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
                formatRupiah,
              }) ||
              'Analisa finansial tidak tersedia saat ini.',
            time: currentTime,
          }
          } else if (analysis.type === 'undo_transaction') {
          if (transactions.length === 0) throw new Error('Tidak ada transaksi yang bisa dibatalkan.')

          const lastTransaction = transactions[0]
          const { error } = await deleteTransaction(lastTransaction.id)
          if (error) throw error

          await syncFinancialViews({
            wallets: true,
            analytics: true,
          })

          botResponse = {
            sender: 'bot',
            text: `Transaksi terakhir (${lastTransaction.desc}) telah dibatalkan.`,
            time: currentTime,
          }
          } else if (analysis.type === 'delete_wallet') {
          const walletToDelete = wallets.find(
            (wallet) => wallet.name.toLowerCase() === (analysis.wallet || '').toLowerCase()
          )

          if (!walletToDelete) throw new Error(`Dompet ${analysis.wallet} tidak ditemukan.`)

          setPendingAction({
            type: 'delete_wallet',
            payload: { id: walletToDelete.id },
            successMessage: `Dompet ${walletToDelete.name} telah diarsipkan.`,
          })

          botResponse = {
            sender: 'bot',
            text: `Anda yakin ingin mengarsipkan dompet ${walletToDelete.name}? Dompet hanya bisa diarsipkan saat saldonya sudah nol.\n\nKetik "Ya" untuk konfirmasi.`,
            time: currentTime,
          }
          } else if (analysis.type === 'bulk_delete_wallets') {
          botResponse = {
            sender: 'bot',
            text: 'Dompet tidak bisa dihapus massal lagi. Jika ada dompet yang sudah tidak dipakai, pindahkan dulu saldonya sampai nol lalu arsipkan satu per satu agar ledger tetap aman.',
            time: currentTime,
          }
          } else if (analysis.type === 'bulk_delete_transactions') {
          botResponse = {
            sender: 'bot',
            text: 'Riwayat ledger tidak bisa dihapus massal lagi karena itu bisa membuat saldo dompet dan analytics tidak sinkron. Jika ada transaksi yang salah, hapus satu per satu dari riwayat agar saldo ikut direvert dengan aman.',
            time: currentTime,
          }
          } else if (analysis.type === 'check_balance') {
          if (analysis.target === 'all') {
            botResponse = {
              sender: 'bot',
              text: `Total gabungan saldo Anda adalah ${formatRupiah(totalBalance)}.`,
              time: currentTime,
            }
          } else {
            const matchedWallet = wallets.find((wallet) =>
              wallet.name.toLowerCase().includes(analysis.target.toLowerCase())
            )

            botResponse = matchedWallet
              ? {
                  sender: 'bot',
                  text: `Saldo di dompet ${matchedWallet.name} adalah ${formatRupiah(matchedWallet.current_balance || 0)}.`,
                  time: currentTime,
                }
              : {
                  sender: 'bot',
                  text: `Dompet "${analysis.target}" tidak ditemukan.`,
                  time: currentTime,
                }
          }
          } else if (analysis.type === 'create_wallet') {
          const { data: newWallet, error: walletError, ledgerCreated } = await addWallet(
            analysis.name,
            analysis.initial_balance,
            analysis.wallet_type
          )

          if (walletError) throw walletError

          if (ledgerCreated) {
            await syncFinancialViews({
              transactions: true,
              analytics: true,
            })
          }

          botResponse = {
            sender: 'bot',
            text: `Dompet ${newWallet.name} berhasil dibuat dengan saldo awal ${formatRupiah(newWallet.current_balance)}.`,
            time: currentTime,
          }
          } else if (analysis.type === 'goal_contribution') {
          const sourceWalletResolution = resolveWalletForMessage({
            text,
            wallets,
            walletRules,
          })

          const { goalId, amount, reply } = analysis
          const sourceWallet = sourceWalletResolution.wallet

          if (!sourceWallet && sourceWalletResolution.resolution === 'needs_clarification') {
            setPendingAction({
              type: 'clarify_goal_contribution_wallet',
              payload: {
                goalId,
                amount,
                reply,
                rawText: text,
              },
            })

            botResponse = {
              sender: 'bot',
              text: `Mau saya ambil ${formatRupiah(amount)} dari dompet yang mana?\n\nPilih salah satu: ${wallets.map((wallet) => wallet.name).slice(0, 4).join(', ')}.`,
              time: currentTime,
            }
          } else {
            const fallbackWallet =
              wallets.find((wallet) => wallet.name.toLowerCase() === 'tunai') || wallets[0]
            const activeWallet = sourceWallet || fallbackWallet
            const rpcContributionResult = activeWallet
              ? await contributeToGoal({
                  goalId,
                  amount,
                  walletId: activeWallet.id,
                })
              : { error: new Error('Dompet sumber tidak ditemukan.'), walletHandled: false }

            if (rpcContributionResult.error) {
              throw rpcContributionResult.error
            }

            await syncFinancialViews({
              wallets: rpcContributionResult.walletHandled,
              transactions: true,
              analytics: true,
            })

            learnFromInput({
              rawText: text,
              walletId: activeWallet.id,
              categoryId: null,
            }).catch(() => null)

            botResponse = {
              sender: 'bot',
              text:
                reply || `Berhasil menambahkan Rp ${formatRupiah(amount)} ke target Anda. Milestone semakin dekat!`,
              time: currentTime,
            }
          }
          } else if (analysis.type === 'goal_withdrawal') {
          const targetGoal = analysis.goalId
            ? goals.find((goal) => goal.id === analysis.goalId)
            : goals.find((goal) => goal.name.toLowerCase() === analysis.goalName?.toLowerCase())

          if (!targetGoal) {
            throw new Error(`Target "${analysis.goalName || 'tersebut'}" tidak ditemukan.`)
          }

          const destinationWallet = analysis.wallet
            ? wallets.find((wallet) => wallet.name.toLowerCase() === analysis.wallet.toLowerCase())
            : wallets.find((wallet) => wallet.name.toLowerCase() === 'tunai') || wallets[0]

          if (!destinationWallet) {
            throw new Error('Dompet tujuan tidak ditemukan.')
          }

          const withdrawalResult = await withdrawFromGoal({
            goalId: targetGoal.id,
            amount: analysis.amount,
            walletId: destinationWallet.id,
            description: `Pencairan ${targetGoal.name} ke ${destinationWallet.name}`,
          })

          if (withdrawalResult.error) {
            throw withdrawalResult.error
          }

          await syncFinancialViews({
            wallets: withdrawalResult.walletHandled,
            transactions: true,
            analytics: true,
          })

          botResponse = {
            sender: 'bot',
            text:
              analysis.reply ||
              `Berhasil mencairkan ${formatRupiah(analysis.amount)} dari target ${targetGoal.name} ke dompet ${destinationWallet.name}.`,
            time: currentTime,
          }
          } else if (analysis.type === 'goal_creation_pending') {
          setPendingAction({
            type: 'create_goal',
            payload: { name: analysis.name, amount: analysis.amount },
          })

          botResponse = {
            sender: 'bot',
            text:
              analysis.reply ||
              `Wah, tabungan baru ya? Target tabungan ${analysis.name} ini mau di-set berapa nominalnya?`,
            time: currentTime,
          }
          } else if (analysis.type === 'transfer') {
          const fromWallet = wallets.find(
            (wallet) => wallet.name.toLowerCase() === analysis.from?.toLowerCase()
          )
          const toWallet = wallets.find(
            (wallet) => wallet.name.toLowerCase() === analysis.to?.toLowerCase()
          )

          if (!fromWallet) throw new Error(`Dompet asal "${analysis.from}" tidak ditemukan.`)
          if (!toWallet) throw new Error(`Dompet tujuan "${analysis.to}" tidak ditemukan.`)

          const { error } = await transferBetweenWallets({
            fromWalletId: fromWallet.id,
            toWalletId: toWallet.id,
            amount: analysis.amount,
            description: `Transfer ${fromWallet.name} ke ${toWallet.name}`,
          })

          if (error) throw error

          await syncFinancialViews({
            wallets: true,
            analytics: true,
          })

          botResponse = {
            sender: 'bot',
            text: `Transfer sebesar ${formatRupiah(analysis.amount)} dari ${fromWallet.name} ke ${toWallet.name} berhasil diproses.`,
            time: currentTime,
          }
          } else {
            botResponse = {
              sender: 'bot',
              text: buildUnknownInputReply(analysis.reply),
              time: currentTime,
            }
          }
        }

        if (botResponse) {
          await saveMessage('bot', botResponse.text, botResponse.card ? { card: botResponse.card } : {})
        }
      } catch (error) {
        console.error('Chat Error:', error)
        await saveMessage(
          'bot',
          buildActionErrorReply(error, { wallets, goals })
        ).catch(() => null)
      } finally {
        setIsTyping(false)
      }
    },
    [
      addWallet,
      analytics,
      budgets,
      categories,
      categoryRules,
      clearAllTransactions,
      clearAllWallets,
      clearTransactionsInRange,
      contributeToGoal,
      createGoalWithContribution,
      deleteWallet,
      deleteTransaction,
      formatRupiah,
      getContextString,
      getSnapshot,
      goals,
      isTyping,
      learnFromInput,
      pendingAction,
      recordTransactionDraft,
      saveMessage,
      withdrawFromGoal,
      totalBalance,
      syncFinancialViews,
      transactions,
      transferBetweenWallets,
      walletRules,
      wallets,
    ]
  )

  const handleAddGoal = async (goalData) => {
    const { error } = await addGoal(goalData)
    if (error) {
      console.error('Error adding goal:', error)
    }
  }

  const handleDeleteGoal = async (id) => {
    const targetGoal = goals.find((goal) => goal.id === id)
    const preferredWallet = wallets.find((wallet) => wallet.name.toLowerCase() === 'tunai') || wallets[0] || null
    const refundAmount = Number(targetGoal?.current_amount || 0)
    const refundTargetName = preferredWallet?.name || 'Tunai'
    const confirmationMessage = refundAmount > 0
      ? `Hapus target milestone ini dan kembalikan ${formatRupiah(refundAmount)} ke dompet ${refundTargetName}?`
      : 'Hapus target milestone ini?'

    if (window.confirm(confirmationMessage)) {
      const { error, walletHandled, ledgerHandled } = await deleteGoal({
        goalId: id,
        walletId: refundAmount > 0 ? preferredWallet?.id || null : null,
      })

      if (error) {
        console.error('Error deleting goal:', error)
        return
      }

      if (walletHandled || ledgerHandled) {
        await syncFinancialViews({
          wallets: true,
          transactions: true,
          analytics: true,
        })
      }
    }
  }

  const handleAddWallet = async (name, balance) => {
    const { error, ledgerCreated } = await addWallet(name, balance)
    if (error) {
      console.error('Error adding wallet:', error)
      return
    }

    if (ledgerCreated) {
      await syncFinancialViews({
        transactions: true,
        analytics: true,
      })
    }
  }

  const handleDeleteWallet = async (id) => {
    const { error } = await deleteWallet(id)

    if (error) {
      window.alert(error.message || 'Dompet belum bisa diarsipkan.')
    }
  }

  return (
    <div className="bg-champagne font-inter text-midnight overflow-hidden h-[100dvh] flex selection:bg-gold/20 selection:text-midnight">
      <DesktopSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <DesktopHeader />

        <div className="flex-1 flex overflow-hidden">
          <section className="flex-1 flex overflow-hidden relative bg-champagne">
            <div className="w-full h-full flex flex-col relative overflow-hidden">
              <header className="md:hidden shrink-0 z-50 relative bg-ivory/90 backdrop-blur-xl border-b border-midnight/5 px-6 py-5 flex justify-between items-center transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-midnight flex items-center justify-center text-white shadow-md shadow-midnight/20">
                    <Sparkles size={16} strokeWidth={2} />
                  </div>
                  <h1 className="text-[17px] font-bold tracking-tight text-midnight font-jakarta">
                    Pocket Kurogi
                  </h1>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-midnight font-jakarta tracking-tight font-bold">
                    {formatRupiah(grandTotalBalance)}
                  </span>
                </div>
              </header>

              <div className="flex-1 relative overflow-hidden bg-transparent">
                <div className={`absolute inset-0 h-full w-full ${activeTab === 'chat' ? 'block' : 'hidden'}`}>
                  <ChatView
                    messages={
                      messages.length > 0
                        ? messages
                        : [
                            {
                              id: 'welcome',
                              sender: 'bot',
                              text: 'Halo! Saya asisten keuangan Anda. Anda bisa mencatat transaksi atau langsung bertanya seperti "bulan ini boros di mana?"',
                              time: new Date().toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              }),
                            },
                          ]
                    }
                    isTyping={isTyping}
                    onSend={handleSend}
                    formatRupiah={formatRupiah}
                  />
                </div>

                <div
                  className={`absolute inset-0 h-full w-full overflow-y-auto no-scrollbar animate-fade-in ${
                    activeTab === 'history' ? 'block' : 'hidden'
                  }`}
                >
                  <HistoryView
                    transactions={transactions}
                    formatRupiah={formatRupiah}
                    onDeleteTransaction={deleteTransaction}
                  />
                </div>

                <div
                  className={`absolute inset-0 h-full w-full overflow-y-auto no-scrollbar animate-fade-in ${
                    activeTab === 'wallets' ? 'block' : 'hidden'
                  }`}
                >
                  <WalletsView
                    wallets={wallets}
                    totalBalance={grandTotalBalance}
                    goals={goals}
                    onAddWallet={handleAddWallet}
                    onDeleteWallet={handleDeleteWallet}
                    onAddGoal={handleAddGoal}
                    onDeleteGoal={handleDeleteGoal}
                    formatRupiah={formatRupiah}
                  />
                </div>

                <div
                  className={`absolute inset-0 h-full w-full overflow-y-auto no-scrollbar animate-fade-in ${
                    activeTab === 'analytics' ? 'block' : 'hidden'
                  }`}
                >
                  <AnalyticsView
                    analytics={analytics}
                    budgets={budgets}
                    formatRupiah={formatRupiah}
                  />
                </div>
              </div>

              <BottomDock activeTab={activeTab} onTabChange={setActiveTab} />
            </div>
          </section>

          <DesktopRightPanel
            analytics={analytics}
            transactions={transactions}
            onExecuteStrategy={(message) => {
              setActiveTab('chat')
              handleSend(message)
            }}
          />
        </div>
      </main>
    </div>
  )
}

function buildUnknownInputReply(reply) {
  const baseReply = reply || 'Format pesannya belum cukup jelas untuk saya proses.'

  return `${baseReply}\n\nCoba pakai format seperti:\n- "beli kopi 25k tunai"\n- "gaji 5jt BCA"\n- "transfer 100k dari BCA ke OVO"\n- "tabung 200k untuk dana darurat"\n- "cairkan 200k dari dana darurat ke tunai"\n- "berapa pengeluaran bulan ini"`
}

function buildActionErrorReply(error, { wallets = [], goals = [] } = {}) {
  const rawMessage = error?.message || 'Gagal memproses permintaan.'
  const normalizedMessage = rawMessage.toLowerCase()
  const walletExamples = wallets
    .slice(0, 3)
    .map((wallet) => wallet.name)
    .filter(Boolean)
  const goalExamples = goals
    .slice(0, 2)
    .map((goal) => goal.name)
    .filter(Boolean)

  if (normalizedMessage.includes('saldo target tidak cukup') || normalizedMessage.includes('goal balance is insufficient')) {
    return 'Saldo targetnya belum cukup untuk dicairkan sebesar itu.\n\nCoba pakai nominal yang lebih kecil. Contoh:\n- "cairkan 100k dari dana darurat ke tunai"\n- "cairkan 50k dari laptop ke BCA"'
  }

  if (normalizedMessage.includes('saldo dompet tidak cukup') || normalizedMessage.includes('insufficient wallet balance')) {
    return 'Saldo dompetnya belum cukup untuk aksi itu.\n\nCoba pakai nominal yang lebih kecil atau pilih dompet lain. Contoh:\n- "beli kopi 25k tunai"\n- "transfer 50k dari BCA ke OVO"\n- "tabung 100k untuk dana darurat"'
  }

  if (normalizedMessage.includes('dompet tidak ditemukan')) {
    const walletLine = walletExamples.length > 0
      ? `\n\nDompet yang tersedia saat ini: ${walletExamples.join(', ')}.`
      : ''

    return `Saya belum menemukan dompet yang dimaksud.${walletLine}\n\nCoba pakai nama dompet yang persis, misalnya:\n- "saldo ${walletExamples[0] || 'Tunai'} berapa"\n- "beli makan 30k ${walletExamples[0] || 'Tunai'}"\n- "transfer 100k dari ${walletExamples[0] || 'BCA'} ke ${walletExamples[1] || 'OVO'}"`
  }

  if (normalizedMessage.includes('nama dompet ini sudah dipakai') || normalizedMessage.includes('wallet name is already in use')) {
    return 'Nama dompet itu sudah dipakai, jadi agar chat tidak bingung namanya perlu dibedakan.\n\nContoh yang aman:\n- "buat dompet BCA Utama 500k"\n- "buat dompet OVO Jajan 100k"'
  }

  if (normalizedMessage.includes('nama target ini sudah dipakai') || normalizedMessage.includes('goal name is already in use')) {
    const goalLine = goalExamples.length > 0
      ? `\n\nTarget aktif saat ini: ${goalExamples.join(', ')}.`
      : ''

    return `Nama target itu sudah dipakai.${goalLine}\n\nCoba pakai nama yang lebih spesifik, misalnya:\n- "buat target Dana Darurat 10jt"\n- "tabung 200k untuk Laptop Kerja"`
  }

  if (normalizedMessage.includes('nominal') || normalizedMessage.includes('amount') || normalizedMessage.includes('lebih besar dari nol')) {
    return 'Nominalnya belum kebaca dengan benar.\n\nCoba pakai format seperti:\n- "beli kopi 25k tunai"\n- "gaji 5jt BCA"\n- "transfer 100k dari BCA ke OVO"'
  }

  if (normalizedMessage.includes('target tidak ditemukan') || normalizedMessage.includes('goal not found')) {
    const goalLine = goalExamples.length > 0
      ? `\n\nTarget aktif saat ini: ${goalExamples.join(', ')}.`
      : ''

    return `Saya belum menemukan target yang dimaksud.${goalLine}\n\nCoba pakai nama target yang persis, misalnya:\n- "tabung 200k untuk ${goalExamples[0] || 'dana darurat'}"\n- "cairkan 100k dari ${goalExamples[0] || 'dana darurat'} ke tunai"\n- "buat target laptop 12jt"`
  }

  return `${rawMessage}\n\nContoh input yang bisa dicoba:\n- "beli kopi 25k tunai"\n- "gaji 5jt BCA"\n- "transfer 100k dari BCA ke OVO"\n- "tabung 200k untuk dana darurat"\n- "cairkan 200k dari dana darurat ke tunai"`
}

function isAffirmativeReply(value = '') {
  return /^(ya|iy|yes|ok|oke|siap|betul|benar)$/i.test(String(value).trim())
}

function isNegativeReply(value = '') {
  return /^(tidak|gak|ga|no|batal|cancel|nggak)$/i.test(String(value).trim())
}
