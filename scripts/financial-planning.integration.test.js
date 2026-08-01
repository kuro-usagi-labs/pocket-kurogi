import crypto from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const { Client } = pg
const describeWithDatabase = process.env.TARGET_DATABASE_URL ? describe : describe.skip

async function authenticate(client, userId) {
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ])
  await client.query('set local role authenticated')
}

async function expectFailure(client, callback, pattern = null) {
  await client.query('savepoint expected_planning_failure')
  try {
    await callback()
    throw new Error('Expected PostgreSQL to reject the operation')
  } catch (error) {
    if (error.message === 'Expected PostgreSQL to reject the operation') throw error
    if (pattern) expect(error.message).toMatch(pattern)
  } finally {
    await client.query('rollback to savepoint expected_planning_failure')
  }
}

describeWithDatabase('P6 financial planning security and invariants', () => {
  let client
  let existingUserId

  beforeAll(async () => {
    client = new Client({
      connectionString: process.env.TARGET_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
    await client.connect()
    const result = await client.query('select id::text from neon_auth."user" order by id limit 1')
    existingUserId = result.rows[0]?.id
    if (!existingUserId) throw new Error('P6 integration test requires a Neon Auth user')
  })

  afterAll(async () => client?.end())

  it('stores plans through owner-scoped RPCs without creating transactions', async () => {
    await client.query('begin')
    try {
      await authenticate(client, existingUserId)
      const before = await client.query('select count(*)::integer as count from public.transactions')
      const schedule = await client.query(
        `select public.save_financial_schedule(
          null, 'Tagihan internet', 'bill', 350000, 'monthly', current_date + 5,
          null, null, null, true, true
        ) as result`,
      )
      const preference = await client.query(
        `select public.set_financial_reminder_preference('bill', false) as result`,
      )
      const allocation = await client.query(
        `select public.save_income_allocation_plan(8000000, 50, 25, 10, 15) as result`,
      )
      const after = await client.query('select count(*)::integer as count from public.transactions')

      expect(schedule.rows[0].result).toMatchObject({
        user_id: existingUserId,
        title: 'Tagihan internet',
        schedule_type: 'bill',
      })
      expect(preference.rows[0].result).toMatchObject({ reminder_type: 'bill', enabled: false })
      expect(allocation.rows[0].result).toMatchObject({ monthly_income: 8000000 })
      expect(after.rows[0].count).toBe(before.rows[0].count)

      await expectFailure(
        client,
        () => client.query(`insert into public.financial_schedules (
          user_id, title, schedule_type, amount, cadence, next_due_date
        ) values ($1, 'bypass', 'bill', 1, 'once', current_date)` , [existingUserId]),
        /permission denied/iu,
      )
      await expectFailure(
        client,
        () => client.query(`select public.save_income_allocation_plan(8000000, 50, 25, 10, 14)`),
        /tepat 100/iu,
      )
    } finally {
      await client.query('rollback')
    }
  })

  it('isolates authenticated users and denies anonymous planning access', async () => {
    await client.query('begin')
    try {
      await authenticate(client, crypto.randomUUID())
      const rows = await client.query('select id from public.financial_schedules')
      expect(rows.rowCount).toBe(0)
    } finally {
      await client.query('rollback')
    }

    await client.query('begin')
    try {
      await client.query('set local role anonymous')
      await expectFailure(
        client,
        () => client.query('select id from public.financial_schedules'),
        /permission denied/iu,
      )
      await expectFailure(
        client,
        () => client.query(`select public.set_financial_reminder_preference('bill', false)`),
        /permission denied/iu,
      )
    } finally {
      await client.query('rollback')
    }
  })
})
