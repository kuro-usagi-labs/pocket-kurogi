import { describe, expect, it } from 'vitest'
import { runAssistantEngine } from './assistantEngine'
import { findFallbackCategory } from '../categoryCatalog'
import { resolveCategoryForMessage } from '../chatLearning'

const categories = [
  { id: 'food', name: 'Makan', category_type: 'expense' },
  { id: 'salary', name: 'Gaji', category_type: 'income' },
  { id: 'other-expense', name: 'Lainnya', category_type: 'expense' },
]

describe('transaction category compatibility', () => {
  it('does not carry an expense category through a new income clarification', () => {
    const context = {
      userId: 'category-user',
      wallets: [{ id: 'cash', name: 'Tunai', current_balance: 100_000 }],
      categories: [{ id: 'snack', name: 'Jajan', category_type: 'expense' }],
      now: new Date('2026-09-23T00:00:00Z'),
    }
    const expense = runAssistantEngine({ ...context, text: 'catat jajan 10rb tunai' })
    const income = runAssistantEngine({
      ...context,
      text: 'tambah pemasukan tunai 50k',
      messages: [{ createdAt: context.now.toISOString(), metadata: { dialogueState: expense.dialogueState } }],
    })
    expect(income.dialogue.status).toBe('clarification')
    const completed = runAssistantEngine({
      ...context,
      text: 'uang masuk',
      dialogueState: JSON.parse(JSON.stringify(income.dialogueState)),
    })
    expect(completed.pendingAction.payload.items[0]).toMatchObject({
      transactionType: 'income',
      amount: 50_000,
      walletId: 'cash',
      categoryId: null,
      category: null,
    })
    expect(income.dialogueState.collectedSlots.category).toBeUndefined()
    expect(income.dialogueState.collectedSlots.description).toBeUndefined()
  })

  it('does not fall back to an expense-only category for income', () => {
    expect(findFallbackCategory(categories, 'income')).toBeNull()
    expect(resolveCategoryForMessage({
      text: 'tambah pemasukan tunai 50k edit saldo',
      transactionType: 'income',
      categories,
    }).category).toBeNull()
  })

  it('selects a compatible fallback even when an incompatible one comes first', () => {
    expect(findFallbackCategory([
      ...categories,
      { id: 'other-both', name: 'Lainnya', category_type: 'both' },
    ], 'income')?.id).toBe('other-both')
    expect(findFallbackCategory(categories, 'expense')?.id).toBe('other-expense')
  })

  it('clarifies an incompatible category correction without changing the income draft', () => {
    const context = {
      userId: 'category-user',
      wallets: [{ id: 'cash', name: 'Tunai', current_balance: 100_000 }],
      categories,
      now: new Date('2026-09-23T00:00:00Z'),
    }
    const first = runAssistantEngine({ ...context, text: 'catat pemasukan tunai 50k hadiah kantor' })
    expect(first.pendingAction.payload.items[0].transactionType).toBe('income')
    const corrected = runAssistantEngine({
      ...context,
      text: 'ganti kategori makan',
      pendingAction: first.pendingAction,
      dialogueState: first.dialogueState,
    })
    expect(corrected.dialogue.status).toBe('correction_clarification')
    expect(corrected.pendingAction.payload).toEqual(first.pendingAction.payload)
    expect(corrected.command).toBeNull()
    expect(corrected.dialogue.clarification.question).toContain('Makan')
  })
})
