import { describe, it, expect } from 'vitest'
import { createFinancialReadState, reduceFinancialReadState } from './financialReadState'

describe('financial reads', () => {
  it('keeps failed first reads unavailable, not zero', () => {
    const result = reduceFinancialReadState(createFinancialReadState('a'), { type: 'failure', ownerId: 'a', generation: 0, error: 'offline' })
    expect(result).toMatchObject({ data: null, status: 'error' })
  })
  it('retains a successful snapshot as stale after failure', () => {
    const ready = reduceFinancialReadState(createFinancialReadState('a'), { type: 'success', ownerId: 'a', generation: 0, data: { totalIncome: 100 }, updatedAt: 'today' })
    expect(reduceFinancialReadState(ready, { type: 'failure', ownerId: 'a', generation: 0, error: 'offline' })).toMatchObject({ data: { totalIncome: 100 }, status: 'stale', updatedAt: 'today' })
  })
  it('rejects completions from a previous owner or request', () => {
    const state = createFinancialReadState('b')
    expect(reduceFinancialReadState(state, { type: 'success', ownerId: 'a', generation: 0, data: { totalIncome: 100 } })).toEqual(state)
    expect(reduceFinancialReadState(state, { type: 'success', ownerId: 'b', generation: -1, data: { totalIncome: 100 } })).toEqual(state)
  })
  it('recovers with a valid empty snapshot', () => {
    const result = reduceFinancialReadState(createFinancialReadState('a'), { type: 'success', ownerId: 'a', generation: 0, data: { totalIncome: 0 }, updatedAt: 'today' })
    expect(result).toMatchObject({ status: 'success', data: { totalIncome: 0 }, error: null })
  })
})
