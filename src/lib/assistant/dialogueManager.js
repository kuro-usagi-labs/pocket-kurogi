import { planClarification } from './clarificationPlanner'
import { createDialogueState, updateDialogueState } from './conversationContext'
import { getIntentDefinition, isMutatingAssistantIntent } from './intentDefinitions'
import {
  buildCorrectedPendingPayload,
  createPendingAction,
} from './pendingActionManager'

export function manageAssistantDialogue({
  userId,
  sourceMessageId = null,
  route,
  entities,
  slotResult,
  safety,
  dialogueState = null,
  pendingAction = null,
  now = new Date(),
} = {}) {
  if (route.intent === 'confirm_pending_action') {
    return {
      status: 'confirm_pending_action',
      pendingAction,
      dialogueState,
      command: {
        type: 'confirm_pending_action',
        pendingActionId: pendingAction?.id || dialogueState?.pendingActionId || null,
      },
    }
  }

  if (route.intent === 'cancel_pending_action') {
    return {
      status: 'cancel_pending_action',
      pendingAction,
      dialogueState: pendingAction
        ? dialogueState
        : createDialogueState({ now }),
      command: {
        type: 'cancel_pending_action',
        pendingActionId: pendingAction?.id || dialogueState?.pendingActionId || null,
      },
    }
  }

  if (route.intent === 'correct_pending_action' && pendingAction) {
    const correction = buildCorrectedPendingPayload(pendingAction, {
      entities,
      text: entities.normalizedText || '',
    })

    if (!correction.changed) {
      const clarification = {
        type: 'correction',
        field: 'correction',
        question: correction.reason,
        candidates: [],
      }
      return {
        status: 'correction_clarification',
        clarification,
        pendingAction,
        dialogueState: updateDialogueState(dialogueState, {
          activeIntent: 'correct_pending_action',
          pendingActionId: pendingAction.id,
          missingSlots: ['correction'],
          lastAssistantQuestion: clarification.question,
        }, now),
      }
    }

    return {
      status: 'correct_pending_action',
      pendingAction: {
        ...pendingAction,
        payload: correction.payload,
      },
      dialogueState: updateDialogueState(dialogueState, {
        activeIntent: pendingAction.intent || null,
        pendingActionId: pendingAction.id,
        missingSlots: [],
        lastAssistantQuestion: null,
      }, now),
      command: {
        type: 'correct_pending_action',
        pendingActionId: pendingAction.id,
        expectedPayloadHash: pendingAction.payloadHash,
        payload: correction.payload,
      },
    }
  }

  if (!safety.safe || route.ambiguous) {
    const clarification = planClarification({
      intentResult: route,
      slotResult,
      entities,
    })
    return {
      status: 'blocked',
      clarification,
      errors: safety.errors,
      dialogueState: updateDialogueState(dialogueState, {
        activeIntent: route.intent === 'unknown' ? null : route.intent,
        lastAssistantQuestion: clarification?.question || null,
      }, now),
    }
  }

  if (!slotResult.complete) {
    const clarification = planClarification({
      intentResult: route,
      slotResult,
      entities,
    })
    return {
      status: 'clarification',
      clarification,
      dialogueState: updateDialogueState(dialogueState, {
        activeIntent: route.intent,
        collectedSlots: slotResult.slots,
        missingSlots: slotResult.missingSlots,
        lastAssistantQuestion: clarification?.question || null,
      }, now),
    }
  }

  if (route.intent === 'calculate_change') {
    const spentAmount =
      Number(slotResult.slots.tenderedAmount || 0) -
      Number(slotResult.slots.changeAmount || 0)
    return {
      status: spentAmount >= 0 ? 'calculation' : 'blocked',
      calculation: spentAmount >= 0
        ? { type: 'change', spentAmount }
        : null,
      errors: spentAmount >= 0
        ? []
        : [{ code: 'NEGATIVE_CHANGE_RESULT', message: 'Kembalian tidak boleh melebihi uang yang dibayarkan.' }],
      dialogueState: createDialogueState({
        activeIntent: 'calculate_change',
        collectedSlots: slotResult.slots,
        now,
      }),
    }
  }

  if (isMutatingAssistantIntent(route.intent)) {
    const definition = getIntentDefinition(route.intent)
    const action = createPendingAction({
      userId,
      intent: route.intent,
      actionType: definition.actionType,
      payload: buildActionPayload(route.intent, slotResult.slots),
      sourceMessageId,
      now,
    })
    return {
      status: 'pending_confirmation',
      pendingAction: action,
      dialogueState: createDialogueState({
        activeIntent: route.intent,
        collectedSlots: slotResult.slots,
        pendingActionId: action.id,
        now,
      }),
    }
  }

  return {
    status: 'query',
    query: {
      intent: route.intent,
      type: getIntentDefinition(route.intent).queryType || route.intent,
      filters: slotResult.slots,
    },
    dialogueState: createDialogueState({
      activeIntent: route.intent,
      collectedSlots: slotResult.slots,
      now,
    }),
  }
}

export function buildActionPayload(intent, slots) {
  if (intent === 'record_expense' || intent === 'record_income') {
    return {
      items: [{
        clientItemId: 'item-1',
        transactionType: intent === 'record_income' ? 'income' : 'expense',
        amount: slots.amount,
        description: slots.description,
        merchant: slots.merchant || null,
        categoryId: slots.category?.id || null,
        category: typeof slots.category === 'string' ? slots.category : slots.category?.name || null,
        walletId: slots.wallet.id,
        wallet: slots.wallet.name,
        occurredAt: slots.occurredAt || null,
        notes: slots.notes || null,
      }],
    }
  }

  if (intent === 'record_multiple_transactions') {
    return {
      items: slots.items.map((item) => ({
        ...item,
        walletId: item.walletId || slots.wallet?.id,
        wallet: item.wallet || slots.wallet?.name,
        occurredAt: item.occurredAt || slots.occurredAt || null,
      })),
    }
  }

  if (intent === 'transfer_money') {
    return {
      amount: slots.amount,
      sourceWalletId: slots.sourceWallet.id,
      sourceWallet: slots.sourceWallet.name,
      destinationWalletId: slots.destinationWallet.id,
      destinationWallet: slots.destinationWallet.name,
      occurredAt: slots.occurredAt || null,
      notes: slots.notes || null,
    }
  }

  if (intent === 'create_budget' || intent === 'update_budget') {
    return {
      categoryId: slots.category.id,
      category: slots.category.name,
      amount: slots.amount,
      period: slots.period || 'monthly',
    }
  }

  if (intent === 'create_saving_goal') {
    return {
      description: slots.description,
      amount: slots.amount,
      deadline: slots.deadline || null,
      initialAmount: Number(slots.initialAmount || 0),
      sourceWalletId: slots.sourceWallet?.id || null,
      sourceWallet: slots.sourceWallet?.name || null,
    }
  }

  if (intent === 'update_saving_goal') {
    return {
      goalId: slots.goal.id,
      goal: slots.goal.name,
      amount: slots.amount || null,
      deadline: slots.deadline || null,
    }
  }

  return { ...slots }
}
