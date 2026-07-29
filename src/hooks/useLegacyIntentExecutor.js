import { useCallback } from 'react'
import { buildAdviceReply, buildAnalyticsReply, resolveAnalyticsTimeframe } from '../lib/analyticsChat'
import { formatCandidateNames, normalizeEntityName } from '../lib/chatEntities'
import { getChatWriteCandidate, isChatWriteIntentType } from '../lib/chatWriteSafety'
import { buildSmartFinanceReply } from '../lib/smartFinance'
import {
  attachRawText,
  buildCategoryFeedbackNote,
  collectCategoryLearningKeywords,
  materializeFinanceDraft,
  shouldLearnCategory,
} from '../lib/appShellChatHelpers'
import { buildWalletDeletionPrompt, buildWalletRestorePrompt } from '../lib/domainMessages'

export function useLegacyIntentExecutor(dependencies) {
  const {
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
  } = dependencies

  const executeIntent = useCallback(
    async (
      analysis,
      {
        source = 'chat',
        rawText = '',
        requestId = null,
        walletCatalog = wallets,
        archivedWalletCatalog = archivedWallets,
      } = {}
    ) => {
      if (!analysis || typeof analysis !== 'object') {
        return {
          text: 'Maaf, permintaan tersebut belum bisa saya pahami.',
        }
      }

      const chatWriteCandidate = getChatWriteCandidate(analysis)
      if (
        source === 'chat' &&
        isChatWriteIntentType(chatWriteCandidate?.type) &&
        chatWriteCandidate.writeDecision !== 'commit'
      ) {
        return {
          text: 'Saya belum menjalankan aksi apa pun karena pemahaman pesan ini belum melewati pemeriksaan ambiguitas. Tulis ulang instruksi final dengan nominal, sumber, tujuan, dan aksi yang jelas.',
          intentStatus: 'needs_confirmation',
          metadata: { confirmationMode: 'input' },
        }
      }

      if (analysis.type === 'finance_draft_revision') {
        const draft = materializeFinanceDraft(analysis.draft, requestId)
        const needsSemanticConfirmation = draft.missingSlots?.includes('semantic_confirmation')
        const needsClarification = draft.status === 'needs_wallet' || needsSemanticConfirmation
        return {
          text: `${analysis.reply || 'Draft transaksi sudah diperbarui.'}\n\nJika sudah benar, bilang "catat transaksi tadi".`,
          ...(needsClarification ? { intentStatus: 'needs_confirmation' } : {}),
          metadata: {
            financeDraft: draft,
            ...(analysis.previousDraftId
              ? { financeDraftCancelled: analysis.previousDraftId }
              : {}),
            ...(needsClarification
              ? {
                  confirmationMode: needsSemanticConfirmation ? 'binary' : 'choice',
                  ...(needsSemanticConfirmation
                    ? { confirmationHint: 'Pastikan jenis, nominal, kategori, dompet, dan waktu pada rangkuman di atas semuanya benar.' }
                    : {}),
                  candidates: needsSemanticConfirmation
                    ? []
                    : walletCatalog.slice(0, 5).map((wallet) => ({
                        id: wallet.id,
                        name: wallet.name,
                      })),
                }
              : {}),
          },
        }
      }

      if (analysis.type === 'finance_calculation' || analysis.type === 'finance_draft') {
        const draft = materializeFinanceDraft(analysis.draft, analysis.requestId || requestId)
        const needsSemanticConfirmation = draft.missingSlots?.includes('semantic_confirmation')
        return {
          text: analysis.reply || 'Rincian transaksi sudah saya siapkan, tetapi belum saya catat.',
          ...(analysis.type === 'finance_draft'
            ? { intentStatus: 'needs_confirmation' }
            : {}),
          metadata: {
            financeDraft: draft,
            ...(analysis.type === 'finance_draft'
              ? {
                  confirmationMode: needsSemanticConfirmation
                    ? 'binary'
                    : draft.missingSlots?.includes('wallet')
                      ? 'choice'
                      : 'input',
                  ...(needsSemanticConfirmation
                    ? { confirmationHint: 'Pastikan jenis, nominal, kategori, dompet, dan waktu pada rangkuman di atas semuanya benar.' }
                    : {}),
                  candidates: needsSemanticConfirmation
                    ? []
                    : draft.missingSlots?.includes('wallet')
                      ? walletCatalog.slice(0, 5).map((wallet) => ({ id: wallet.id, name: wallet.name }))
                      : [],
                }
              : {}),
          },
        }
      }

      if (analysis.type === 'finance_draft_cancel') {
        return {
          text: analysis.reply || 'Baik, draft transaksi sebelumnya saya batalkan.',
          metadata: analysis.draftId
            ? { financeDraftCancelled: analysis.draftId }
            : undefined,
        }
      }

      if (analysis.type === 'liquidity_advice') {
        return {
          text: analysis.reply || 'Saya belum memiliki data saldo yang cukup untuk membuat saran.',
        }
      }

      if (analysis.type === 'transaction_batch') {
        const rawItems = Array.isArray(analysis.items) ? analysis.items : []
        if (rawItems.length === 0) {
          return {
            text: 'Rincian transaksi batch masih kosong, jadi belum ada saldo yang saya ubah.',
          }
        }

        const defaultWallet = walletCatalog.find((wallet) => wallet.id === analysis.walletId) ||
          (walletCatalog.length === 1 ? walletCatalog[0] : null)
        const unresolvedWallet = rawItems.some((item) => {
          const walletId = item.walletId || defaultWallet?.id
          return !walletId || !walletCatalog.some((wallet) => wallet.id === walletId)
        })
        const totalAmount = rawItems.reduce((sum, item) => sum + Number(item.amount || 0), 0)

        if (unresolvedWallet) {
          const draft = materializeFinanceDraft({
            ...analysis,
            type: undefined,
            status: 'needs_wallet',
            missingSlots: ['wallet'],
            items: rawItems,
          }, analysis.requestId || requestId)

          const previewLines = rawItems.map((item, index) =>
            `${index + 1}. ${item.transactionType === 'income' ? 'Pemasukan' : 'Pengeluaran'} ${formatRupiah(item.amount)} - ${item.desc || item.category || 'Tanpa keterangan'}`
          )

          return {
            text: `Pemahaman saya:\n${previewLines.join('\n')}\n\nTotal **${formatRupiah(totalAmount)}** belum dicatat. Pilih dompet yang digunakan: ${formatCandidateNames(walletOptions)}.`,
            intentStatus: 'needs_confirmation',
            metadata: {
              financeDraft: draft,
              confirmationMode: 'choice',
              candidates: walletOptions.slice(0, 5).map((wallet) => ({
                id: wallet.id,
                name: wallet.name,
              })),
            },
          }
        }

        const preparedItems = []
        for (const item of rawItems) {
          const resolvedWalletId = item.walletId || defaultWallet.id
          const resolvedWallet = walletCatalog.find((wallet) => wallet.id === resolvedWalletId)
          const normalizedRawText = String(item.rawText || item.desc || analysis.rawText || rawText || '').trim()
          const categoryResolution = await resolveTransactionCategory({
            analysis: {
              ...item,
              transactionType: item.transactionType || 'expense',
            },
            rawText: normalizedRawText,
            allowCreate: false,
          })
          const category = categoryResolution.category
          const categoryName = categoryResolution.categoryName

          preparedItems.push({
            ...item,
            clientItemId: item.clientItemId || `item-${preparedItems.length + 1}`,
            type: item.transactionType || 'expense',
            desc: item.desc || categoryName,
            walletId: resolvedWalletId,
            wallet: resolvedWallet.name,
            categoryId: category?.id || null,
            category: categoryName,
            categoryResolution,
            rawText: normalizedRawText,
          })
        }

        const batchRequestId = analysis.requestId || analysis.draftId || requestId
        const batchResult = await addTransactionsBatch({
          items: preparedItems,
          requestId: batchRequestId,
        })

        if (batchResult.error) {
          throw batchResult.error
        }

        await syncFinancialViews({
          wallets: true,
          analytics: true,
        })

        if (!batchResult.data?.replayed) {
          for (const item of preparedItems) {
            if (!item.rawText) continue
            learnFromInput({
              rawText: item.rawText,
              walletId: item.walletId,
              categoryId: shouldLearnCategory(item.categoryResolution) ? item.categoryId : null,
              categoryKeywords: collectCategoryLearningKeywords(item, item.categoryResolution),
            }).catch((error) => {
              console.warn('Batch learning update failed:', error)
            })
          }
        }

        const transactionResults = Array.isArray(batchResult.data?.transactions)
          ? batchResult.data.transactions
          : []
        const transactionIdByClientItem = new Map(
          transactionResults.map((item) => [item.client_item_id, item.transaction_id])
        )
        const expenseTotal = preparedItems
          .filter((item) => item.type !== 'income')
          .reduce((sum, item) => sum + Number(item.amount || 0), 0)
        const incomeTotal = preparedItems
          .filter((item) => item.type === 'income')
          .reduce((sum, item) => sum + Number(item.amount || 0), 0)
        const summary = preparedItems.map((item) =>
          `- ${item.desc}: **${formatRupiah(item.amount)}** (${item.category})`
        )
        const arithmeticNote = Number(analysis.arithmetic?.changeAmount || 0) > 0
          ? `\nKembalian tunai: **${formatRupiah(analysis.arithmetic.changeAmount)}**.`
          : ''
        const headline = preparedItems.length === 1
          ? `${preparedItems[0].type === 'income' ? 'Pemasukan' : 'Pengeluaran'} **${formatRupiah(preparedItems[0].amount)}** berhasil dicatat.`
          : `Berhasil mencatat **${preparedItems.length} transaksi** sekaligus.`
        const replayNote = batchResult.data?.replayed
          ? '\nPermintaan ini sudah pernah diproses, jadi saldo tidak didebit dua kali.'
          : ''

        return {
          text: [headline, ...summary].join('\n') + arithmeticNote + replayNote,
          card: {
            batch: true,
            amount: expenseTotal || incomeTotal,
            wallet: preparedItems[0]?.wallet || analysis.wallet,
            items: preparedItems.map((item) => ({
              transactionId: transactionIdByClientItem.get(item.clientItemId) || null,
              type: item.type,
              amount: item.amount,
              category: item.category,
              wallet: item.wallet,
              desc: item.desc,
              canEdit: true,
              canDelete: true,
            })),
          },
          metadata: analysis.draftId
            ? { financeDraftResolved: analysis.draftId }
            : undefined,
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
            transactionId: transactionResult.data?.id || null,
            type: analysis.transactionType,
            amount: analysis.amount,
            category: categoryName,
            wallet: resolvedWallet.name,
            desc: description,
            canEdit: transactionResult.data?.canEdit !== false,
            canDelete: transactionResult.data?.canDelete !== false,
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

      if (
        analysis.type === 'affordability_query' ||
        analysis.type === 'daily_budget_query' ||
        analysis.type === 'goal_projection_query' ||
        analysis.type === 'recurring_expense_query'
      ) {
        return {
          text: buildSmartFinanceReply({
            query: analysis,
            wallets: walletCatalog,
            goals,
            transactions,
            totalBalance,
            formatRupiah,
          }),
        }
      }

      if (analysis.type === 'undo_transaction') {
        const undoResult = await undoLatestManualTransaction()

        if (undoResult.error) {
          throw undoResult.error
        }

        return {
          text: `Transaksi terakhir (${undoResult.data?.desc || 'manual'}) telah dibatalkan.`,
        }
      }

      if (analysis.type === 'correct_last_transaction') {
        const lastEditableTransaction = transactions.find((transaction) => transaction.canEdit)

        if (!lastEditableTransaction) {
          throw new Error('Tidak ada transaksi manual yang bisa dikoreksi.')
        }

        const nextWalletId = analysis.walletId || lastEditableTransaction.walletId
        const nextWallet = walletCatalog.find((wallet) => wallet.id === nextWalletId)

        if (!nextWalletId || !nextWallet) {
          return {
            text: 'Dompet untuk koreksi transaksi ini belum jelas. Sebutkan dompetnya secara spesifik.',
            intentStatus: 'needs_confirmation',
          }
        }

        const nextType = analysis.transactionType || lastEditableTransaction.type || 'expense'
        let nextCategoryId = lastEditableTransaction.categoryId || null
        let nextCategoryName = lastEditableTransaction.category || 'Lainnya'

        if (analysis.category) {
          const nextCategoryResolution = resolveCategory(analysis.category, {
            transactionType: nextType,
          })

          if (nextCategoryResolution.category?.id) {
            nextCategoryId = nextCategoryResolution.category.id
            nextCategoryName = nextCategoryResolution.category.name
          }
        }

        const previousDescription = String(
          lastEditableTransaction.merchant ||
          lastEditableTransaction.notes ||
          lastEditableTransaction.desc ||
          ''
        ).trim()
        const shouldRefreshDescription =
          !previousDescription ||
          normalizeEntityName(previousDescription) === normalizeEntityName(lastEditableTransaction.category)

        const nextDescription =
          analysis.desc ||
          (analysis.category && shouldRefreshDescription ? nextCategoryName : previousDescription) ||
          nextCategoryName

        const nextAmount = Number(analysis.amount || lastEditableTransaction.amount || 0)
        const updateResult = await handleUpdateTransaction({
          transactionId: lastEditableTransaction.id,
          walletId: nextWalletId,
          categoryId: nextCategoryId,
          type: nextType,
          amount: nextAmount,
          desc: nextDescription,
          notes: lastEditableTransaction.notes || null,
          occurredAt: lastEditableTransaction.occurredAt,
        })

        if (updateResult.error) {
          throw updateResult.error
        }

        const updatedTransaction = updateResult.data || {
          ...lastEditableTransaction,
          amount: nextAmount,
          wallet: nextWallet.name,
          type: nextType,
          desc: nextDescription,
          category: nextCategoryName,
        }
        const directionLabel = nextType === 'income' ? 'ke' : 'dari'
        const sign = nextType === 'income' ? '+' : '-'

        return {
          text: `Terkoreksi: ${updatedTransaction.desc || nextDescription} ${sign}${formatRupiah(nextAmount)} ${directionLabel} **${nextWallet.name}**.`,
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
          metadata: { confirmationMode: 'binary' },
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
          metadata: { confirmationMode: 'binary' },
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
          metadata: {
            confirmationMode:
              analysis.reason === 'unknown_wallet' && analysis.action === 'create_wallet'
                ? 'binary'
                : analysis.candidates?.length
                  ? 'choice'
                  : 'input',
            ...(analysis.candidates?.length
              ? {
                candidates: analysis.candidates.map((candidate) => ({
                  id: candidate.id,
                  name: candidate.name,
                })),
              }
              : {}),
          },
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
      addTransactionsBatch,
      addWallet,
      analytics,
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
      archivedWallets,
      walletOptions,
      wallets,
      withdrawFromGoal,
    ]
  )

  return executeIntent
}
