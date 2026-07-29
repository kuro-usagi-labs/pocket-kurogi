import { useCallback } from 'react'
import { runAssistantEngine } from '../lib/assistant/assistantEngine'
import { inferMemoryCandidates } from '../lib/assistant/assistantMemory'
import {
  buildAssistantCancellationResponse,
  buildAssistantCorrectionResponse,
  buildAssistantExecutionResponse,
  buildAssistantPendingResponse,
  isAssistantInsightIntent,
  shouldHandleAssistantEngineResult,
} from '../lib/assistant/assistantChatBridge'
import { useAssistantState } from './useAssistantState'

export function useDeterministicAssistant({
  wallets = [],
  categories = [],
  budgets = [],
  goals = [],
  transactions = [],
  messages = [],
  totalBalance = 0,
  syncFinancialViews,
} = {}) {
  const assistantState = useAssistantState()

  const processMessage = useCallback(async ({
    text,
    sourceMessageId = null,
  } = {}) => {
    const commonInput = {
      text,
      userId: assistantState.userId,
      sourceMessageId,
      wallets,
      categories,
      budgets,
      goals,
      transactions,
      messages,
      memory: assistantState.memories,
      dialogueState: assistantState.dialogueState,
      financialState: {
        totalBalance,
        budgets,
      },
    }

    if (assistantState.pendingAction) {
      const engineResult = runAssistantEngine({
        ...commonInput,
        pendingAction: assistantState.pendingAction,
      })
      return {
        handled: true,
        response: await processExistingPendingAction({
          assistantState,
          engineResult,
          syncFinancialViews,
        }),
      }
    }

    let engineResult = runAssistantEngine(commonInput)
    if (isAssistantInsightIntent(engineResult.route?.intent)) {
      const contextResult = await assistantState.fetchFinancialContext()
      if (contextResult.error) throw contextResult.error
      const databaseContext = contextResult.data || {}
      const databaseWallets = databaseContext.wallets || wallets
      engineResult = runAssistantEngine({
        ...commonInput,
        wallets: databaseWallets,
        budgets: databaseContext.budgets || budgets,
        goals: databaseContext.goals || goals,
        transactions: databaseContext.transactions || [],
        financialState: {
          totalBalance: databaseWallets
            .filter((wallet) => !wallet.is_archived)
            .reduce((sum, wallet) => sum + Number(wallet.current_balance || 0), 0),
          budgets: databaseContext.budgets || budgets,
        },
      })
    }

    await persistExplicitMemory({
      assistantState,
      engineResult,
      text,
    })

    if (!shouldHandleAssistantEngineResult(engineResult)) {
      return { handled: false, response: null }
    }

    if (engineResult.command?.type === 'cancel_pending_action') {
      await persistDialogueState({
        assistantState,
        dialogueState: engineResult.dialogueState,
        pendingActionId: null,
      })
      return {
        handled: true,
        response: buildAssistantCancellationResponse(null),
      }
    }

    let persistedAction = null
    if (engineResult.pendingAction) {
      const stageResult = await assistantState.stagePendingAction(
        engineResult.pendingAction
      )
      if (stageResult.error) throw stageResult.error
      persistedAction = stageResult.data
    }

    await persistDialogueState({
      assistantState,
      dialogueState: engineResult.dialogueState,
      pendingActionId:
        persistedAction?.id ||
        engineResult.dialogueState?.pendingActionId ||
        null,
    })

    return {
      handled: true,
      response: buildAssistantPendingResponse(engineResult, persistedAction),
    }
  }, [
    assistantState,
    budgets,
    categories,
    goals,
    messages,
    syncFinancialViews,
    totalBalance,
    transactions,
    wallets,
  ])

  return {
    ...assistantState,
    processMessage,
  }
}

async function processExistingPendingAction({
  assistantState,
  engineResult,
  syncFinancialViews,
}) {
  if (engineResult.command?.type === 'confirm_pending_action') {
    const action = assistantState.pendingAction
    const executionResult = await assistantState.confirmPendingAction(action)
    if (executionResult.error) throw executionResult.error

    await syncFinancialViews?.({
      wallets: true,
      transactions: true,
      goals: true,
      analytics: true,
      names: true,
    })
    return buildAssistantExecutionResponse(action, executionResult.data)
  }

  if (engineResult.command?.type === 'cancel_pending_action') {
    const action = assistantState.pendingAction
    const cancellationResult = await assistantState.cancelPendingAction(action)
    if (cancellationResult.error) throw cancellationResult.error
    return buildAssistantCancellationResponse(action)
  }

  if (engineResult.command?.type === 'correct_pending_action') {
    const correctionResult = await assistantState.correctPendingAction({
      action: assistantState.pendingAction,
      payload: engineResult.command.payload,
    })
    if (correctionResult.error) throw correctionResult.error

    await persistDialogueState({
      assistantState,
      dialogueState: engineResult.dialogueState,
      pendingActionId: correctionResult.data.id,
    })
    return buildAssistantCorrectionResponse(correctionResult.data)
  }

  await persistDialogueState({
    assistantState,
    dialogueState: engineResult.dialogueState,
    pendingActionId: assistantState.pendingAction.id,
  })
  return buildAssistantPendingResponse(engineResult, assistantState.pendingAction)
}

async function persistExplicitMemory({
  assistantState,
  engineResult,
  text,
}) {
  const candidates = inferMemoryCandidates({
    text,
    resolvedWallet:
      engineResult.entities.wallets?.find((wallet) => wallet.id) ||
      null,
    resolvedCategory: engineResult.entities.categories?.[0] || null,
    correction: /\b(?:koreksi|revisi|ubah|ganti|harusnya)\b/iu.test(text),
    userId: assistantState.userId,
  })

  for (const candidate of candidates) {
    const memoryResult = await assistantState.rememberPreference(candidate)
    if (memoryResult.error) throw memoryResult.error
  }
}

async function persistDialogueState({
  assistantState,
  dialogueState,
  pendingActionId,
}) {
  if (!dialogueState?.expiresAt) return
  const stateResult = await assistantState.saveDialogueState({
    ...dialogueState,
    pendingActionId,
  })
  if (stateResult.error) throw stateResult.error
}
