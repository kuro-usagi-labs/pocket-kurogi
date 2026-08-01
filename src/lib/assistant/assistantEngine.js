import { planClarification } from './clarificationPlanner'
import { collectConversationContext, createDialogueState } from './conversationContext'
import { manageAssistantDialogue } from './dialogueManager'
import { detectEmotionalContext } from './emotionalContext'
import { extractAssistantEntities } from './entityExtractor'
import {
  buildFinancialInsightSnapshot,
  composeFinancialQueryResult,
} from './financialInsights'
import { routeAssistantIntent } from './intentRouter'
import { composeAssistantResponse } from './responseComposer'
import { validateAssistantInterpretation } from './safetyValidator'
import { resolveIntentSlots } from './slotResolver'
import { getSemanticFrameAnalysis } from './semanticFrame'

export function runAssistantEngine({
  text = '',
  userId,
  sourceMessageId = null,
  wallets = [],
  categories = [],
  budgets = [],
  goals = [],
  transactions = [],
  messages = [],
  memory = [],
  dialogueState = null,
  pendingAction = null,
  financialState = {},
  now = new Date(),
  semanticFrame = null,
} = {}) {
  const context = dialogueState ||
    collectConversationContext(messages, now) ||
    createDialogueState({ now })
  const prepared = getSemanticFrameAnalysis(semanticFrame)
  const entities = prepared?.entities || extractAssistantEntities({
    text,
    wallets,
    categories,
    goals,
    memory,
    now,
  })
  const initialRoute = prepared?.route || routeAssistantIntent({
    text,
    entities,
    dialogueState: pendingAction
      ? { ...context, pendingActionId: pendingAction.id, pendingAction }
      : context,
  })
  const route = resolveRouteWithContext(initialRoute, context, entities, pendingAction)
  const routeChanged = route.intent !== initialRoute.intent
  const slotResult = !routeChanged && prepared?.slotResult
    ? prepared.slotResult
    : resolveIntentSlots({
    intent: route.intent,
    entities,
    dialogueState: context,
    text,
  })
  const safety = !routeChanged && prepared?.safety
    ? prepared.safety
    : validateAssistantInterpretation({
    intent: route.intent,
    entities,
    slots: slotResult.slots,
    route,
  })
  const emotion = prepared?.emotion || detectEmotionalContext(text, financialState)
  const dialogue = manageAssistantDialogue({
    userId,
    sourceMessageId,
    route,
    entities,
    slotResult,
    safety,
    dialogueState: context,
    pendingAction,
    now,
  })
  const insight = shouldBuildInsight(route.intent)
    ? composeFinancialQueryResult({
        intent: route.intent,
        slots: slotResult.slots,
        snapshot: buildFinancialInsightSnapshot({
          transactions,
          budgets,
          goals,
          now,
        }),
        transactions,
        budgets,
        goals,
        wallets,
        memory,
        now,
        focus: resolveInsightFocus(entities.normalizedText),
      })
    : null
  const clarification = dialogue.clarification || planClarification({
    intentResult: route,
    slotResult,
    entities,
  })
  const response = composeAssistantResponse({
    intent: route.intent,
    confidence: route.score,
    emotion,
    slots: slotResult.slots,
    clarification,
    pendingAction: dialogue.pendingAction,
    insight,
    status: dialogue.status,
    memory,
    recentAssistantMessages: getRecentAssistantMessages(messages),
  })

  return {
    version: 1,
    text,
    entities,
    route,
    slots: slotResult,
    safety,
    emotionalContext: emotion,
    dialogue,
    response,
    pendingAction: dialogue.pendingAction || null,
    dialogueState: dialogue.dialogueState || context,
    query: dialogue.query || null,
    command: dialogue.command || null,
    insight,
  }
}

function getRecentAssistantMessages(messages = []) {
  return messages
    .filter((message) => message?.sender === 'bot' || message?.role === 'assistant')
    .map((message) => message?.text || message?.content || '')
    .filter(Boolean)
    .slice(-12)
}

function resolveInsightFocus(text = '') {
  if (/\b(?:hari ini|tadi)\b/iu.test(text)) return 'today'
  if (/\b(?:minggu ini|pekan ini)\b/iu.test(text)) return 'week'
  return 'overview'
}

function shouldBuildInsight(intent) {
  return [
    'query_income',
    'query_expenses',
    'query_balance',
    'query_transactions',
    'query_spending_summary',
    'query_category_summary',
    'query_wallet',
    'query_budget',
    'query_saving_goal',
    'financial_advice',
    'emotional_support',
  ].includes(intent)
}

function resolveRouteWithContext(route, context, entities, pendingAction) {
  if (pendingAction) {
    if (
      ['confirm_pending_action', 'cancel_pending_action', 'correct_pending_action']
        .includes(route.intent)
    ) {
      return route
    }
    if (context?.activeIntent === 'correct_pending_action') {
      return {
        ...route,
        intent: 'correct_pending_action',
        score: Math.max(route.score, 0.92),
        ambiguous: false,
        evidence: [...new Set([
          ...(route.evidence || []),
          'dialogue_state:correct_pending_action',
        ])],
      }
    }
    return route
  }
  if (!context?.activeIntent || !context.missingSlots?.length) return route
  if (
    route.intent === 'cancel_pending_action' ||
    route.intent === 'confirm_pending_action'
  ) {
    return route
  }

  const answersMissingWallet =
    context.missingSlots.includes('wallet') &&
    Boolean(entities.wallets?.[0]?.id)
  const shortSlotAnswer =
    String(entities.normalizedText || '').split(/\s+/u).length <= 6 &&
    (answersMissingWallet ||
      context.missingSlots.includes('description') ||
      context.missingSlots.includes('amount'))

  if (!shortSlotAnswer) return route
  return {
    ...route,
    intent: context.activeIntent,
    score: Math.max(route.score, 0.9),
    ambiguous: false,
    evidence: [...new Set([
      ...(route.evidence || []),
      `dialogue_state:${context.activeIntent}`,
    ])],
  }
}
