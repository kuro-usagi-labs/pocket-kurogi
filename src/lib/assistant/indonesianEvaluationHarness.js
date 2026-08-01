import {
  assessIndonesianFinanceUtterance,
  normalizeIndonesianFinanceText,
} from '../indonesianFinanceLanguage'
import { extractLearningRuleCandidate } from './learningRuleExtractor'
import { extractMoneyEntities } from './moneyExtractor'
import { runAssistantEngine } from './assistantEngine'
import {
  EVALUATION_FIXTURES,
  EVALUATION_NOW,
  INDONESIAN_ASSISTANT_EVALUATION_CORPUS,
} from './indonesianEvaluationCorpus'

export function buildEvaluationContext(overrides = {}) {
  return {
    userId: EVALUATION_FIXTURES.userId,
    wallets: [...EVALUATION_FIXTURES.wallets],
    categories: [...EVALUATION_FIXTURES.categories],
    goals: [...EVALUATION_FIXTURES.goals],
    transactions: [],
    budgets: [],
    memory: [],
    messages: [],
    now: new Date(EVALUATION_NOW),
    ...overrides,
  }
}

export function evaluateSingleTurnCase(testCase, overrides = {}) {
  const context = buildEvaluationContext(overrides)
  const engine = runAssistantEngine({
    ...context,
    text: testCase.text,
  })
  const utterance = assessIndonesianFinanceUtterance({
    text: testCase.text,
    mentions: extractMoneyEntities(testCase.text),
  })

  return {
    id: testCase.id,
    tags: testCase.tags,
    text: testCase.text,
    normalizedText: normalizeIndonesianFinanceText(testCase.text),
    entities: engine.entities,
    route: engine.route,
    safety: engine.safety,
    dialogue: engine.dialogue,
    pendingAction: engine.pendingAction,
    command: engine.command,
    utterance,
    response: engine.response,
  }
}

export async function evaluateUnsafeLocalWriteCase(testCase, overrides = {}) {
  void overrides
  const mentions = extractMoneyEntities(testCase.text)
  const utterance = assessIndonesianFinanceUtterance({
    text: testCase.text,
    mentions,
  })

  return {
    id: testCase.id,
    tags: testCase.tags,
    text: testCase.text,
    mentions,
    utterance,
    analysis: null,
    committedWrite: !utterance.blocksWrite,
  }
}

export function evaluateTeachingCase(testCase, overrides = {}) {
  const context = buildEvaluationContext(overrides)
  const normalizedText = normalizeIndonesianFinanceText(testCase.text)

  return {
    id: testCase.id,
    tags: testCase.tags,
    text: testCase.text,
    normalizedText,
    result: extractLearningRuleCandidate({
      text: testCase.text,
      wallets: context.wallets,
      categories: context.categories,
    }),
  }
}

export function evaluateConversationCase(testCase, overrides = {}) {
  const context = buildEvaluationContext(overrides)
  const messages = [...(context.messages || [])]
  let dialogueState = null
  let pendingAction = null
  const steps = []

  for (const [index, step] of testCase.steps.entries()) {
    const result = runAssistantEngine({
      ...context,
      text: step.text,
      sourceMessageId: `${testCase.id}-step-${index + 1}`,
      messages,
      dialogueState,
      pendingAction,
    })
    steps.push({
      index,
      text: step.text,
      expected: step.expected,
      result,
    })
    messages.push(
      { sender: 'user', text: step.text },
      { sender: 'bot', text: result.response?.text || '' }
    )
    dialogueState = result.dialogueState
    pendingAction = result.pendingAction
  }

  return {
    id: testCase.id,
    tags: testCase.tags,
    steps,
    messages,
  }
}

export async function runIndonesianAssistantEvaluation({
  corpus = INDONESIAN_ASSISTANT_EVALUATION_CORPUS,
  context = {},
} = {}) {
  const singleTurn = corpus.singleTurn.map((testCase) =>
    evaluateSingleTurnCase(testCase, context)
  )
  const unsafeLocalWrites = await Promise.all(
    corpus.unsafeLocalWrites.map((testCase) =>
      evaluateUnsafeLocalWriteCase(testCase, context)
    )
  )
  const conversations = corpus.conversations.map((testCase) =>
    evaluateConversationCase(testCase, context)
  )
  const teaching = corpus.teaching.map((testCase) =>
    evaluateTeachingCase(testCase, context)
  )

  return {
    singleTurn,
    unsafeLocalWrites,
    conversations,
    teaching,
    totalCases:
      singleTurn.length +
      unsafeLocalWrites.length +
      conversations.length +
      teaching.length,
  }
}

export function getEngineWriteState(result) {
  return {
    hasPendingAction: Boolean(result?.pendingAction),
    hasMutationCommand: Boolean(
      result?.command &&
      [
        'confirm_pending_action',
        'correct_pending_action',
      ].includes(result.command.type)
    ),
  }
}
