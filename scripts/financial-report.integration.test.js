import { describe, expect, it } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { readFinancialReport } from '../api/_lib/financialReport.js'
import { readTransactionHistory } from '../api/_lib/transactionHistory.js'
const suite = process.env.TARGET_DATABASE_URL ? describe : describe.skip
suite('financial report database snapshot (read-only)', () => {
  it('matches owned ledger totals and returns no data for an unknown owner', async () => {
    // Use the same HTTPS transport as production (no local TCP dependency).
    const sql = neon(process.env.TARGET_DATABASE_URL)
    const owners =
      await sql`select user_id from public.transactions group by user_id having count(*) <= 10000 limit 1`
    expect(owners.length).toBe(1)
    const owner = owners[0].user_id
    const report = await readFinancialReport(sql, owner, 'all')
    const [totals] =
      await sql`select count(*)::int as count, coalesce(sum(amount) filter(where analytics_bucket='income'),0)::text as income, coalesce(sum(amount) filter(where analytics_bucket='expense'),0)::text as expense from public.transactions where user_id=${owner}::uuid`
    expect(report.transactions.length).toBe(totals.count)
    expect(report.totals.income).toBe(Math.round(Number(totals.income) * 100))
    expect(report.totals.expense).toBe(Math.round(Number(totals.expense) * 100))
    const empty = await readFinancialReport(sql, crypto.randomUUID(), 'all')
    expect(empty.transactions).toEqual([])
    const history = []
    let cursor = null
    for (;;) {
      const page = await readTransactionHistory(sql, owner, cursor)
      history.push(...page.transactions)
      if (page.transactions.length < 30) break
      const last = page.transactions.at(-1)
      cursor = { createdAt: last.created_at, id: last.id }
      expect(history.length).toBeLessThanOrEqual(totals.count)
    }
    expect(history).toHaveLength(totals.count)
    expect(new Set(history.map(row => row.id)).size).toBe(totals.count)
    expect((await readTransactionHistory(sql, crypto.randomUUID())).transactions).toEqual([])
  })
})
