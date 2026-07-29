import crypto from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const { Client } = pg
const describeWithDatabase = process.env.TARGET_DATABASE_URL ? describe : describe.skip

async function expectPrivilegeDenied(client, sql, parameters = []) {
  await client.query('savepoint expected_privilege_error')
  try {
    await client.query(sql, parameters)
    throw new Error('Expected PostgreSQL to reject the operation')
  } catch (error) {
    expect(error.code).toBe('42501')
  } finally {
    await client.query('rollback to savepoint expected_privilege_error')
  }
}

describeWithDatabase('Neon RLS roles', () => {
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
    if (!existingUserId) throw new Error('RLS integration test requires at least one Neon Auth user')
  })

  afterAll(async () => {
    await client?.end()
  })

  it('lets authenticated users see only rows owned by their JWT subject', async () => {
    await client.query('begin')
    try {
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [existingUserId])
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: existingUserId }),
      ])
      await client.query('set local role authenticated')

      const ownProfiles = await client.query('select id::text from public.profiles')
      const ownWallets = await client.query('select user_id::text from public.wallets')

      expect(ownProfiles.rows).toEqual([{ id: existingUserId }])
      expect(ownWallets.rows.every((row) => row.user_id === existingUserId)).toBe(true)
    } finally {
      await client.query('rollback')
    }
  })

  it('hides another user rows from an authenticated JWT subject', async () => {
    const foreignUserId = crypto.randomUUID()
    await client.query('begin')
    try {
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [foreignUserId])
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: foreignUserId }),
      ])
      await client.query('set local role authenticated')

      const profiles = await client.query('select id from public.profiles')
      const wallets = await client.query('select id from public.wallets')
      const categories = await client.query('select id from public.categories')

      expect(profiles.rowCount).toBe(0)
      expect(wallets.rowCount).toBe(0)
      expect(categories.rowCount).toBe(0)
    } finally {
      await client.query('rollback')
    }
  })

  it('denies the anonymous role direct access to user tables', async () => {
    await client.query('begin')
    try {
      await client.query('set local role anonymous')
      await expectPrivilegeDenied(client, 'select id from public.profiles')
      await expectPrivilegeDenied(client, 'select id from public.wallets')
      await expectPrivilegeDenied(client, 'select id from public.transactions')
    } finally {
      await client.query('rollback')
    }
  })

  it.each(['authenticated', 'anonymous'])(
    'denies %s all access to migration tracking',
    async (role) => {
      await client.query('begin')
      try {
        await client.query(`set local role ${role}`)
        await expectPrivilegeDenied(client, 'select * from public.schema_migrations')
        await expectPrivilegeDenied(
          client,
          "insert into public.schema_migrations (name, checksum) values ('rls-test.sql', 'test')",
        )
      } finally {
        await client.query('rollback')
      }
    },
  )
})
