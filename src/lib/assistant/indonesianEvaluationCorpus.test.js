import { describe, expect, it } from 'vitest'
import {
  INDONESIAN_ASSISTANT_EVALUATION_CORPUS,
  REQUIRED_EVALUATION_TAGS,
} from './indonesianEvaluationCorpus'
import {
  evaluateConversationCase,
  evaluateSingleTurnCase,
  evaluateTeachingCase,
  evaluateUnsafeLocalWriteCase,
  getEngineWriteState,
  runIndonesianAssistantEvaluation,
} from './indonesianEvaluationHarness'

describe('Indonesian assistant evaluation corpus integrity', () => {
  it('uses unique stable ids and covers every required language and safety class', () => {
    const allCases = Object.values(INDONESIAN_ASSISTANT_EVALUATION_CORPUS).flat()
    const ids = allCases.map((testCase) => testCase.id)
    const tags = new Set(allCases.flatMap((testCase) => testCase.tags || []))

    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every(Boolean)).toBe(true)
    expect(REQUIRED_EVALUATION_TAGS.filter((tag) => !tags.has(tag))).toEqual([])
  })
})

describe('Indonesian assistant single-turn regression corpus', () => {
  it.each(INDONESIAN_ASSISTANT_EVALUATION_CORPUS.singleTurn)(
    '$id',
    (testCase) => {
      const actual = evaluateSingleTurnCase(testCase)
      const expected = testCase.expected

      for (const fragment of expected.normalizedIncludes || []) {
        expect(actual.normalizedText, testCase.id).toContain(fragment)
      }
      if (expected.amountValues) {
        expect(
          actual.entities.amounts.map((amount) => amount.value),
          testCase.id
        ).toEqual(expected.amountValues)
      }
      for (const [flag, value] of Object.entries(expected.entityFlags || {})) {
        expect(actual.entities[flag], `${testCase.id}:${flag}`).toBe(value)
      }
      if (expected.intent) {
        expect(actual.route.intent, testCase.id).toBe(expected.intent)
      }
      if (expected.status) {
        expect(actual.dialogue.status, testCase.id).toBe(expected.status)
      }
      if (typeof expected.pendingAction === 'boolean') {
        expect(Boolean(actual.pendingAction), testCase.id)
          .toBe(expected.pendingAction)
      }
      for (const code of expected.safetyCodes || []) {
        expect(
          actual.safety.errors.map((error) => error.code),
          testCase.id
        ).toContain(code)
      }
      if (expected.pendingItemAmounts) {
        expect(
          actual.pendingAction?.payload?.items?.map((item) => item.amount),
          testCase.id
        ).toEqual(expected.pendingItemAmounts)
      }
      if (expected.pendingWalletIds) {
        expect(
          actual.pendingAction?.payload?.items?.map((item) => item.walletId),
          testCase.id
        ).toEqual(expected.pendingWalletIds)
      }
      if (expected.writeBlocked) {
        expect(getEngineWriteState(actual), testCase.id).toEqual({
          hasPendingAction: false,
          hasMutationCommand: false,
        })
      }
    }
  )
})

describe('Indonesian assistant unsafe-write regression corpus', () => {
  it.each(INDONESIAN_ASSISTANT_EVALUATION_CORPUS.unsafeLocalWrites)(
    '$id',
    async (testCase) => {
      const actual = await evaluateUnsafeLocalWriteCase(testCase)
      const ambiguityCodes = actual.utterance.ambiguities.map(({ code }) => code)

      expect(actual.committedWrite, testCase.id).toBe(false)
      expect(actual.utterance.blocksWrite, testCase.id).toBe(true)
      expect(ambiguityCodes, testCase.id).toContain(testCase.expectedAmbiguity)
    }
  )
})

describe('Indonesian assistant multi-turn and reference regression corpus', () => {
  it.each(INDONESIAN_ASSISTANT_EVALUATION_CORPUS.conversations)(
    '$id',
    (testCase) => {
      const actual = evaluateConversationCase(testCase)

      for (const step of actual.steps) {
        const { expected, result } = step
        const label = `${testCase.id}:step-${step.index + 1}`

        if (expected.intent) {
          expect(result.route.intent, label).toBe(expected.intent)
        }
        if (expected.status) {
          expect(result.dialogue.status, label).toBe(expected.status)
        }
        if (expected.missingSlots) {
          expect(result.slots.missingSlots, label).toEqual(expected.missingSlots)
        }
        if (typeof expected.pendingAction === 'boolean') {
          expect(Boolean(result.pendingAction), label)
            .toBe(expected.pendingAction)
        }
        if (expected.commandType) {
          expect(result.command?.type, label).toBe(expected.commandType)
        }
        if (expected.pendingItemAmounts) {
          expect(
            result.pendingAction?.payload?.items?.map((item) => item.amount),
            label
          ).toEqual(expected.pendingItemAmounts)
        }
        if (expected.pendingWalletIds) {
          expect(
            result.pendingAction?.payload?.items?.map((item) => item.walletId),
            label
          ).toEqual(expected.pendingWalletIds)
        }
        if (expected.pendingDescriptions) {
          expect(
            result.pendingAction?.payload?.items?.map((item) => item.description),
            label
          ).toEqual(expected.pendingDescriptions)
        }
        if (expected.commandItemAmounts) {
          expect(
            result.command?.payload?.items?.map((item) => item.amount),
            label
          ).toEqual(expected.commandItemAmounts)
        }
      }
    }
  )
})

describe('Indonesian assistant explicit teaching regression corpus', () => {
  it.each(INDONESIAN_ASSISTANT_EVALUATION_CORPUS.teaching)(
    '$id',
    (testCase) => {
      const actual = evaluateTeachingCase(testCase)
      const { replyIncludes, ...expectedShape } = testCase.expected

      expect(actual.result, testCase.id).toMatchObject(expectedShape)
      if (replyIncludes) {
        expect(actual.result?.reply.toLowerCase(), testCase.id)
          .toContain(replyIncludes.toLowerCase())
      }
    }
  )

  it('applies learned category and wallet rules only through account-scoped ids', async () => {
    const report = await runIndonesianAssistantEvaluation()
    const categoryTeaching = report.teaching.find(
      ({ id }) => id === 'teach-category-rule'
    )?.result
    const walletTeaching = report.teaching.find(
      ({ id }) => id === 'teach-wallet-rule'
    )?.result

    expect(categoryTeaching).toMatchObject({
      categoryId: 'category-coffee',
      keyword: 'ngopi',
    })
    expect(walletTeaching).toMatchObject({
      walletId: 'wallet-bca',
      keyword: 'kantor',
    })
    expect(report.totalCases).toBeGreaterThanOrEqual(20)
  })
})
