import { expect, it } from 'vitest'
import { validateLanguageProposal } from './languageProposal'
const categories = [{ id: 'food', name: 'Makan', category_type: 'expense' }, { id: 'salary', name: 'Gaji', category_type: 'income' }]
const interpret = category => validateLanguageProposal({ proposal: { intent: 'record_expense', amountText: '15k', category }, text: 'beli onigiri 15k', context: { categories } })
it('accepts semantic suggestions only from owned compatible categories', () => {
  expect(interpret('Makan').slots.category).toEqual({ id: 'food', name: 'Makan' })
  expect(interpret('Gaji').slots.category).toBeUndefined()
  expect(interpret('Unknown category').slots.category).toBeUndefined()
  expect(interpret('').slots.amount).toBe(15000)
})
