import { expect, it, vi } from 'vitest'
import { readTransactionHistory } from './transactionHistory.js'

it('scopes history and both joins to the authenticated owner and keeps all dates', async () => {
  const sql = vi.fn(async () => [{ id: 'saved-row' }])
  expect(await readTransactionHistory(sql, 'owner')).toEqual({ transactions: [{ id: 'saved-row' }] })
  const [parts, ...values] = sql.mock.calls[0]
  const query = parts.join('?')
  expect(query).toContain('where t.user_id = ?::uuid')
  expect(query).toContain('w.user_id = ?::uuid')
  expect(query).toContain('c.user_id = ?::uuid')
  expect(query).toContain('left join public.wallets')
  expect(query).toContain('order by t.created_at desc, t.id desc')
  expect(query).toContain('limit 30')
  expect(values.slice(0, 3)).toEqual(['owner', 'owner', 'owner'])
  expect(query).not.toContain('interval')
})

it('validates pagination before querying and passes cursor values as parameters', async () => {
  const sql = vi.fn(async () => [])
  await expect(readTransactionHistory(sql, 'owner', { createdAt: 'invalid', id: 'invalid' })).rejects.toMatchObject({ statusCode: 400 })
  expect(sql).not.toHaveBeenCalled()
  const cursor = { createdAt: '2026-09-23T00:00:00.000Z', id: '11111111-1111-4111-8111-111111111111' }
  await readTransactionHistory(sql, 'owner', cursor)
  expect(sql.mock.calls[0].slice(1)).toContain(cursor.id)
})
