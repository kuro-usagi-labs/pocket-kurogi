import { describe, expect, it } from 'vitest'
import { extractMoneyEntities, parseMoneyValue } from './moneyExtractor'
import { matchMoney, parseMoneyMatch } from '../chatEntities'
import { extractAmountFromText } from '../chatLearning'
import { runAssistantEngine } from './assistantEngine'
import { orchestrateAssistantMessage } from './unifiedAssistantOrchestrator'

describe('complete monetary numbers', () => {
  it.each([
    ['2,860,097', 2860097], ['2.860.097', 2860097], ['2860097', 2860097],
    ['2,860,097.50', 2860097.5], ['2.860.097,50', 2860097.5],
    ['25,000', 25000], ['25.000', 25000], ['2,5 juta', 2500000], ['2.5jt', 2500000],
  ])('keeps %s intact across parsers', (number, amount) => {
    const text = `catat gaji ${number}`
    expect(extractMoneyEntities(text)).toEqual([expect.objectContaining({ value: amount })])
    expect(parseMoneyMatch(matchMoney(text))).toBe(amount)
    expect(extractAmountFromText(text)).toBe(amount)
  })
  it.each(['2,86,097', '2.860.09', '2,860.097,50'])('does not partially parse malformed grouping %s', (number) => {
    expect(parseMoneyValue(number)).toBe(0)
    expect(extractMoneyEntities(`catat gaji ${number}`)).toEqual([])
    expect(parseMoneyMatch(matchMoney(`catat gaji ${number}`))).toBeNull()
  })
  it('preserves the screenshot salary through wallet clarification and confirmation', () => {
    const text = 'aku baru mendapatkan gaji hari ini yaitu 2,860,097 tolong catat'
    const wallets = [
      { id: 'bca', name: 'BCA', current_balance: 0 },
      { id: 'cash', name: 'Tunai', current_balance: 0 },
    ]
    const categories = [{ id: 'salary', name: 'Gaji', category_type: 'income' }]
    const orchestration = orchestrateAssistantMessage({ text, wallets, categories })
    const first = runAssistantEngine({ text, wallets, categories, semanticFrame: orchestration.frame })
    expect(first.slots.slots.amount).toBe(2860097)
    expect(first.response.text).toContain('2.860.097')
    expect(first.pendingAction).toBeNull()
    const next = runAssistantEngine({ text: 'pakai BCA', userId: 'test-user', wallets, categories, dialogueState: first.dialogueState })
    expect(next.slots.slots.amount).toBe(2860097)
    expect(next.pendingAction).toBeTruthy()
  })
})
