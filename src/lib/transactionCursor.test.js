import { it, expect } from 'vitest'
import { transactionCursor, transactionCursorFilter } from './transactionCursor'
it('includes tied timestamp IDs in the next page predicate', () => {
  const row = { created_at: '2026-09-23T00:00:00.000Z', id: '11111111-1111-4111-8111-111111111111' }
  expect(transactionCursorFilter(transactionCursor(row))).toBe('created_at.lt.2026-09-23T00:00:00.000Z,and(created_at.eq.2026-09-23T00:00:00.000Z,id.lt.11111111-1111-4111-8111-111111111111)')
})
it('rejects malformed filters', () => {
  expect(() => transactionCursorFilter({ createdAt: 'now(),id.gt.0', id: 'bad' })).toThrow()
})
