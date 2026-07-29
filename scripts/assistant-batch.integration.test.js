import crypto from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const { Client } = pg
const describeWithDatabase = process.env.TARGET_DATABASE_URL ? describe : describe.skip

async function setAuthenticatedRole(client, userId) {
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId }),
  ])
  await client.query('set local role authenticated')
}

async function expectDatabaseFailure(client, callback, messagePattern) {
  await client.query('savepoint expected_database_failure')
  try {
    await callback()
    throw new Error('Expected PostgreSQL to reject the operation')
  } catch (error) {
    if (error.message === 'Expected PostgreSQL to reject the operation') throw error
    if (messagePattern) expect(error.message).toMatch(messagePattern)
  } finally {
    await client.query('rollback to savepoint expected_database_failure')
  }
}

async function expectPrivilegeDenied(client, sql, parameters = []) {
  await client.query('savepoint expected_privilege_error')
  try {
    await client.query(sql, parameters)
    throw new Error('Expected PostgreSQL to reject the operation')
  } catch (error) {
    if (error.message === 'Expected PostgreSQL to reject the operation') throw error
    expect(error.code).toBe('42501')
  } finally {
    await client.query('rollback to savepoint expected_privilege_error')
  }
}

function createBatchItems(walletId, amounts) {
  return amounts.map((amount, index) => ({
    client_item_id: `integration-${index + 1}`,
    wallet_id: walletId,
    category_id: null,
    transaction_type: 'expense',
    amount,
    merchant: `Assistant integration ${index + 1}`,
    notes: null,
    occurred_at: null,
  }))
}

async function callBatch(client, requestId, items) {
  const result = await client.query(
    'select public.record_transactions_batch($1::uuid, $2::jsonb) as result',
    [requestId, JSON.stringify(items)],
  )
  return result.rows[0]?.result
}

describeWithDatabase('atomic assistant transaction batches', () => {
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
    if (!existingUserId) throw new Error('Batch integration test requires at least one Neon Auth user')
  })

  afterAll(async () => {
    await client?.end()
  })

  it('records all items atomically and replays the same request without another debit', async () => {
    await client.query('begin')
    try {
      const walletResult = await client.query(
        `insert into public.wallets (user_id, name, wallet_type, initial_balance, current_balance)
         values ($1, $2, 'cash', 100000, 100000)
         returning id::text`,
        [existingUserId, `Batch replay ${crypto.randomUUID()}`],
      )
      const walletId = walletResult.rows[0].id
      const requestId = crypto.randomUUID()
      const items = createBatchItems(walletId, [20000, 10000])

      await setAuthenticatedRole(client, existingUserId)
      const first = await callBatch(client, requestId, items)
      const replay = await callBatch(client, requestId, items)
      const balance = await client.query(
        'select current_balance::numeric as balance from public.wallets where id = $1',
        [walletId],
      )
      const transactions = await client.query(
        'select id::text from public.transactions where wallet_id = $1 order by created_at',
        [walletId],
      )

      expect(first).toMatchObject({ replayed: false, item_count: 2, total_amount: 30000 })
      expect(first).toMatchObject({
        expense_total: 30000,
        income_total: 0,
        net_delta: -30000,
      })
      expect(replay).toMatchObject({ replayed: true, item_count: 2, total_amount: 30000 })
      expect(replay.transactions).toEqual(first.transactions)
      expect(Number(balance.rows[0].balance)).toBe(70000)
      expect(transactions.rowCount).toBe(2)
    } finally {
      await client.query('rollback')
    }
  })

  it('rolls back every item when a later debit exceeds the wallet balance', async () => {
    await client.query('begin')
    try {
      const walletResult = await client.query(
        `insert into public.wallets (user_id, name, wallet_type, initial_balance, current_balance)
         values ($1, $2, 'cash', 100000, 100000)
         returning id::text`,
        [existingUserId, `Batch rollback ${crypto.randomUUID()}`],
      )
      const walletId = walletResult.rows[0].id

      await setAuthenticatedRole(client, existingUserId)
      await expectDatabaseFailure(
        client,
        () => callBatch(client, crypto.randomUUID(), createBatchItems(walletId, [80000, 30000])),
        /Saldo dompet tidak cukup/i,
      )

      const balance = await client.query(
        'select current_balance::numeric as balance from public.wallets where id = $1',
        [walletId],
      )
      const transactionCount = await client.query(
        'select count(*)::integer as count from public.transactions where wallet_id = $1',
        [walletId],
      )

      expect(Number(balance.rows[0].balance)).toBe(100000)
      expect(transactionCount.rows[0].count).toBe(0)
    } finally {
      await client.query('rollback')
    }
  })

  it('rejects reusing an idempotency key with a different payload', async () => {
    await client.query('begin')
    try {
      const walletResult = await client.query(
        `insert into public.wallets (user_id, name, wallet_type, initial_balance, current_balance)
         values ($1, $2, 'cash', 100000, 100000)
         returning id::text`,
        [existingUserId, `Batch mismatch ${crypto.randomUUID()}`],
      )
      const walletId = walletResult.rows[0].id
      const requestId = crypto.randomUUID()

      await setAuthenticatedRole(client, existingUserId)
      await callBatch(client, requestId, createBatchItems(walletId, [10000]))
      await expectDatabaseFailure(
        client,
        () => callBatch(client, requestId, createBatchItems(walletId, [20000])),
        /payload transaksi yang berbeda/i,
      )

      const balance = await client.query(
        'select current_balance::numeric as balance from public.wallets where id = $1',
        [walletId],
      )
      expect(Number(balance.rows[0].balance)).toBe(90000)
    } finally {
      await client.query('rollback')
    }
  })

  it('rejects duplicate trimmed item IDs and over-precise amounts before changing balance', async () => {
    await client.query('begin')
    try {
      const walletResult = await client.query(
        `insert into public.wallets (user_id, name, wallet_type, initial_balance, current_balance)
         values ($1, $2, 'cash', 100000, 100000)
         returning id::text`,
        [existingUserId, `Batch validation ${crypto.randomUUID()}`],
      )
      const walletId = walletResult.rows[0].id
      await setAuthenticatedRole(client, existingUserId)

      const duplicateIds = createBatchItems(walletId, [10000, 5000])
      duplicateIds[0].client_item_id = 'same-id'
      duplicateIds[1].client_item_id = ' same-id '
      await expectDatabaseFailure(
        client,
        () => callBatch(client, crypto.randomUUID(), duplicateIds),
        /harus unik/i,
      )

      const overPrecise = createBatchItems(walletId, [1.005])
      await expectDatabaseFailure(
        client,
        () => callBatch(client, crypto.randomUUID(), overPrecise),
        /paling banyak dua desimal/i,
      )

      const balance = await client.query(
        'select current_balance::numeric as balance from public.wallets where id = $1',
        [walletId],
      )
      expect(Number(balance.rows[0].balance)).toBe(100000)
    } finally {
      await client.query('rollback')
    }
  })

  it('reports income, expense, and net totals for a mixed batch', async () => {
    await client.query('begin')
    try {
      const walletResult = await client.query(
        `insert into public.wallets (user_id, name, wallet_type, initial_balance, current_balance)
         values ($1, $2, 'cash', 100000, 100000)
         returning id::text`,
        [existingUserId, `Batch mixed ${crypto.randomUUID()}`],
      )
      const walletId = walletResult.rows[0].id
      const items = createBatchItems(walletId, [20000, 10000])
      items[0].transaction_type = 'income'

      await setAuthenticatedRole(client, existingUserId)
      const result = await callBatch(client, crypto.randomUUID(), items)
      const balance = await client.query(
        'select current_balance::numeric as balance from public.wallets where id = $1',
        [walletId],
      )

      expect(result).toMatchObject({
        total_amount: 30000,
        income_total: 20000,
        expense_total: 10000,
        net_delta: 10000,
      })
      expect(Number(balance.rows[0].balance)).toBe(110000)
    } finally {
      await client.query('rollback')
    }
  })

  it('keeps the idempotency ledger private from application roles', async () => {
    for (const role of ['authenticated', 'anonymous']) {
      await client.query('begin')
      try {
        if (role === 'authenticated') {
          await setAuthenticatedRole(client, existingUserId)
        } else {
          await client.query('set local role anonymous')
        }
        await expectPrivilegeDenied(client, 'select * from public.transaction_batch_requests')
        await expectPrivilegeDenied(
          client,
          `insert into public.transaction_batch_requests (user_id, request_id, payload_hash)
           values ($1, $2, 'forbidden')`,
          [existingUserId, crypto.randomUUID()],
        )
      } finally {
        await client.query('rollback')
      }
    }
  })

  it('does not allow anonymous callers to execute the batch RPC', async () => {
    await client.query('begin')
    try {
      await client.query('set local role anonymous')
      await expectPrivilegeDenied(
        client,
        'select public.record_transactions_batch($1::uuid, $2::jsonb)',
        [crypto.randomUUID(), JSON.stringify([])],
      )
    } finally {
      await client.query('rollback')
    }
  })
})
