import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { describe, it, expect } from 'vitest'
const suite = process.env.TARGET_DATABASE_URL ? describe : describe.skip
suite('audit remediation database contracts (isolated test branch only)', () => {
  it('uses a unique cursor for 31 rows with identical timestamps', async () => {
    const client = new pg.Client({ connectionString: process.env.TARGET_DATABASE_URL })
    await client.connect()
    try {
      await client.query('begin')
      await client.query('create temporary table cursor_fixture(id uuid primary key, created_at timestamptz) on commit drop')
      await client.query(`insert into cursor_fixture select ('11111111-1111-4111-8111-' || lpad(n::text,12,'0'))::uuid, '2026-09-23T00:00:00Z' from generate_series(1,31) n`)
      const first = (await client.query('select * from cursor_fixture order by created_at desc,id desc limit 30')).rows
      const last = first.at(-1)
      const second = (await client.query('select * from cursor_fixture where created_at < $1 or (created_at = $1 and id < $2) order by created_at desc,id desc limit 30', [last.created_at, last.id])).rows
      expect(second.map(row => row.id)).toEqual(['11111111-1111-4111-8111-000000000001'])
    } finally { await client.query('rollback'); await client.end() }
  })
  it('isolates user limits, allows two slots, and never clears another worker cooldown on success', async () => {
    const client = new pg.Client({ connectionString: process.env.TARGET_DATABASE_URL })
    await client.connect()
    try {
      await client.query('begin')
      await client.query(await readFile(new URL('../neon/migrations/20260923030000_provider_fairness.sql', import.meta.url), 'utf8'))
      const scope = `test-${crypto.randomUUID()}`
      const userA = crypto.randomUUID(), userB = crypto.randomUUID()
      const acquire = async (user, token) => (await client.query('select assistant_private.acquire_provider_slot($1,$2,$3) as reason', [scope, user, token])).rows[0].reason
      const release = (token, delay = 0) => client.query('select assistant_private.release_provider_slot($1,$2,$3)', [scope, token, delay])
      for (let i=0; i<10; i++) { const token = crypto.randomUUID(); expect(await acquire(userA, token)).toBe('acquired'); await release(token) }
      // Seed an exhausted current window atomically with the assertion: remote
      // round trips above can legitimately straddle a minute boundary.
      await client.query('update assistant_private.provider_user_usage set used=10, window_start=date_trunc(\'minute\',clock_timestamp()) + interval \'1 minute\' where scope=$1 and user_id=$2', [scope, userA])
      expect(await acquire(userA, crypto.randomUUID())).toBe('user_rate_limit')
      const tokenB = crypto.randomUUID(), tokenC = crypto.randomUUID()
      expect(await acquire(userB, tokenB)).toBe('acquired')
      expect(await acquire(userB, tokenC)).toBe('acquired')
      expect(await acquire(userB, crypto.randomUUID())).toBe('capacity')
      await release(tokenB, 60000)
      await release(tokenC)
      expect(await acquire(userB, crypto.randomUUID())).toBe('cooldown')
    } finally { await client.query('rollback'); await client.end() }
  })
})
