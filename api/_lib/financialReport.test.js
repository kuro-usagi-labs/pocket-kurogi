import { expect, it, vi } from 'vitest'
import { readFinancialReport } from './financialReport'

it('scopes the snapshot and joined labels to the authenticated owner', async () => {
  const sql = vi.fn(async () => [])
  await readFinancialReport(sql, 'owner', '2026-09')
  const [strings, ...values] = sql.mock.calls[0]
  expect(strings.join('?')).toContain('c.user_id = ?::uuid')
  expect(strings.join('?')).toContain('w.user_id = ?::uuid')
  expect(strings.join('?')).toContain('where t.user_id = ?::uuid')
  expect(values.filter(value => value === 'owner')).toHaveLength(3)
  expect(values).toContain('2026-08-31T17:00:00.000Z')
  expect(values).toContain('2026-09-30T17:00:00.000Z')
  expect(values).toContain(10001)
})
it('rejects invalid periods before querying the database', async () => {
  const sql = vi.fn()
  await expect(readFinancialReport(sql, 'owner', 'invalid')).rejects.toThrow()
  expect(sql).not.toHaveBeenCalled()
})
