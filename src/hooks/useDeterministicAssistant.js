import { useCallback } from 'react'
import { runAssistantEngine } from '../lib/assistant/assistantEngine'
import {
  MemoryLifecycleError,
  activateProposedMemoryCandidate,
  proposeMemoryCandidate,
} from '../lib/assistant/memoryLifecycle'
import {
  buildAssistantCancellationResponse,
  buildAssistantCorrectionResponse,
  buildAssistantExecutionResponse,
  buildAssistantPendingResponse,
  isAssistantInsightIntent,
  shouldHandleAssistantEngineResult,
  shouldSupersedePendingAction,
} from '../lib/assistant/assistantChatBridge'
import { useAssistantState } from './useAssistantState'

export function useDeterministicAssistant({
  wallets = [],
  archivedWallets = [],
  categories = [],
  budgets = [],
  goals = [],
  transactions = [],
  messages = [],
  schedules = [],
  reminderPreferences = {},
  totalBalance = 0,
  categoryRules = [],
  walletRules = [],
  syncFinancialViews,
} = {}) {
  const assistantState = useAssistantState()

  const processMessage = useCallback(async ({
    text,
    sourceMessageId = null,
    semanticFrame = null,
  } = {}) => {
    const stateSnapshot = assistantState.getSnapshot()
    const commonInput = {
      text,
      userId: assistantState.userId,
      sourceMessageId,
      wallets,
      archivedWallets,
      categories,
      budgets,
      goals,
      transactions,
      messages,
      memory: stateSnapshot.memories,
      categoryRules,
      walletRules,
      dialogueState: stateSnapshot.dialogueState,
      financialState: {
        totalBalance,
        budgets,
      },
      semanticFrame,
      schedules,
      reminderPreferences,
    }

    if (stateSnapshot.pendingAction) {
      const engineResult = runAssistantEngine({
        ...commonInput,
        pendingAction: stateSnapshot.pendingAction,
      })
      if (!shouldSupersedePendingAction(engineResult)) {
        return {
          handled: true,
          response: await processExistingPendingAction({
            assistantState,
            engineResult,
            pendingAction: stateSnapshot.pendingAction,
            syncFinancialViews,
          }),
        }
      }

      // A fresh message starts a fresh turn. Leaving an old draft active here
      // made ordinary questions repeatedly resurrect an unrelated action.
      const supersessionResult = await assistantState.supersedePendingActions()
      if (supersessionResult.error) throw supersessionResult.error
      commonInput.pendingAction = null
      commonInput.dialogueState = null
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
        schedules: databaseContext.schedules || schedules,
        reminderPreferences: databaseContext.reminderPreferences || reminderPreferences,
        financialState: {
          totalBalance: databaseWallets
            .filter((wallet) => !wallet.is_archived)
            .reduce((sum, wallet) => sum + Number(wallet.current_balance || 0), 0),
          budgets: databaseContext.budgets || budgets,
        },
      })
    }

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
    categoryRules,
    goals,
    messages,
    schedules,
    reminderPreferences,
    syncFinancialViews,
    totalBalance,
    transactions,
    wallets,
    walletRules,
    archivedWallets,
  ])

  const proposeMemoryCandidates = useCallback(({
    candidates = [],
    sourceMessageId = null,
    now = new Date(),
  } = {}) => {
    const accountId = assistantState.userId
    if (!accountId || candidates.length === 0) {
      return { data: null, rejected: [] }
    }

    const proposals = []
    const displayItems = []
    const rejected = []
    for (const [index, candidate] of candidates.entries()) {
      const evidenceBase = String(
        sourceMessageId ||
        `memory-${candidate.key}-${index}`
      )
      try {
        proposals.push(proposeMemoryCandidate({
          candidate: {
            ...candidate,
            userId: accountId,
          },
          accountId,
          instructionEvidence: {
            id: `${evidenceBase}:instruction:${candidate.key}`,
            kind: candidate.source === 'correction'
              ? 'correction'
              : 'explicit_instruction',
            source: candidate.source,
            confidence: candidate.confidence,
            reference: sourceMessageId,
            value: candidate.value,
          },
          now,
        }))
        displayItems.push({
          key: candidate.key,
          value: candidate.value,
          displayValue: candidate.displayValue || candidate.value,
        })
      } catch (error) {
        if (error instanceof MemoryLifecycleError) {
          rejected.push({
            key: candidate.key,
            reason: error.code,
          })
          continue
        }
        throw error
      }
    }

    if (proposals.length === 0) {
      return { data: null, rejected }
    }

    const createdAt = new Date(now)
    return {
      data: {
        id: `memory-proposal:${sourceMessageId || createdAt.getTime()}`,
        accountId,
        sourceMessageId,
        status: 'proposed',
        createdAt: createdAt.toISOString(),
        expiresAt: new Date(
          createdAt.getTime() + 15 * 60 * 1000
        ).toISOString(),
        memories: proposals,
        displayItems,
      },
      rejected,
    }
  }, [assistantState])

  const confirmMemoryProposal = useCallback(async ({
    proposal,
    sourceMessageId,
    now = new Date(),
  } = {}) => {
    const accountId = assistantState.userId
    if (!accountId || !proposal || proposal.accountId !== accountId) {
      throw new MemoryLifecycleError(
        'ACCOUNT_SCOPE_MISMATCH',
        'Proposal memory tidak berada dalam scope akun ini.'
      )
    }
    if (
      proposal.status !== 'proposed' ||
      !Array.isArray(proposal.memories) ||
      proposal.memories.length === 0 ||
      new Date(proposal.expiresAt).getTime() <= new Date(now).getTime()
    ) {
      throw new MemoryLifecycleError(
        'INVALID_STATUS_TRANSITION',
        'Proposal memory sudah tidak aktif.'
      )
    }

    const stored = []
    for (const proposedMemory of proposal.memories) {
      const activated = activateProposedMemoryCandidate({
        proposal: proposedMemory,
        accountId,
        confirmationEvidence: {
          id: `${sourceMessageId}:confirmation:${proposedMemory.key}`,
          kind: 'confirmation',
          source: 'explicit',
          confidence: 1,
          affirmed: true,
          reference: sourceMessageId,
          value: proposedMemory.value,
        },
        now,
      })
      const memoryResult = await assistantState.rememberPreference(
        activated.memory
      )
      if (memoryResult.error) throw memoryResult.error
      stored.push(activated.lifecycle)
    }

    return { data: stored, error: null }
  }, [assistantState])

  return {
    ...assistantState,
    processMessage,
    proposeMemoryCandidates,
    confirmMemoryProposal,
  }
}

async function processExistingPendingAction({
  assistantState,
  engineResult,
  pendingAction,
  syncFinancialViews,
}) {
  if (engineResult.command?.type === 'confirm_pending_action') {
    const action = pendingAction
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
    const action = pendingAction
    const cancellationResult = await assistantState.cancelPendingAction(action)
    if (cancellationResult.error) throw cancellationResult.error
    return buildAssistantCancellationResponse(action)
  }

  if (engineResult.command?.type === 'correct_pending_action') {
    const correctionResult = await assistantState.correctPendingAction({
      action: pendingAction,
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
    pendingActionId: pendingAction.id,
  })
  return buildAssistantPendingResponse(engineResult, pendingAction)
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
