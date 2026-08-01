import crypto from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const { Client } = pg
const describeWithDatabase = process.env.TARGET_DATABASE_URL ? describe : describe.skip

async function setAuthenticatedRole(client, userId) {
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ])
  await client.query('set local role authenticated')
}

async function expectPrivilegeDenied(client, sql, parameters = []) {
  await client.query('savepoint assistant_privilege_error')
  try {
    await client.query(sql, parameters)
    throw new Error('Expected PostgreSQL to reject the operation')
  } catch (error) {
    if (error.message === 'Expected PostgreSQL to reject the operation') throw error
    expect(error.code).toBe('42501')
  } finally {
    await client.query('rollback to savepoint assistant_privilege_error')
  }
}

async function expectDatabaseFailure(client, callback, messagePattern) {
  await client.query('savepoint assistant_expected_failure')
  try {
    await callback()
    throw new Error('Expected PostgreSQL to reject the operation')
  } catch (error) {
    if (error.message === 'Expected PostgreSQL to reject the operation') throw error
    if (messagePattern) expect(error.message).toMatch(messagePattern)
  } finally {
    await client.query('rollback to savepoint assistant_expected_failure')
  }
}

describeWithDatabase('deterministic assistant persisted state', () => {
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
    if (!existingUserId) throw new Error('Assistant integration test requires a Neon Auth user')
  })

  afterAll(async () => {
    await client?.end()
  })

  it('persists dialogue state and curated memory only through owner-validated RPCs', async () => {
    await client.query('begin')
    try {
      await setAuthenticatedRole(client, existingUserId)
      const dialogue = await client.query(
        `select public.save_assistant_dialogue_state(
          $1::jsonb,
          now() + interval '15 minutes'
        ) as result`,
        [JSON.stringify({
          activeIntent: 'record_expense',
          collectedSlots: { amount: 20000 },
          missingSlots: ['wallet'],
        })],
      )
      const memory = await client.query(
        `select public.remember_assistant_preference(
          'preferred_wallet',
          $1::jsonb,
          0.92,
          'explicit'
        ) as result`,
        [JSON.stringify('wallet-test')],
      )

      expect(dialogue.rows[0].result.state).toMatchObject({
        activeIntent: 'record_expense',
        missingSlots: ['wallet'],
      })
      expect(memory.rows[0].result).toMatchObject({
        memory_key: 'preferred_wallet',
        confidence: 0.92,
      })

      await expectPrivilegeDenied(
        client,
        `insert into public.assistant_memories (
          user_id, memory_key, memory_value, confidence, source
        ) values ($1, 'salary_date', '25'::jsonb, 1, 'explicit')`,
        [existingUserId],
      )
    } finally {
      await client.query('rollback')
    }
  })

  it('lets an authenticated owner forget one or all memories but denies anonymous callers', async () => {
    await client.query('begin')
    try {
      await setAuthenticatedRole(client, existingUserId)
      await client.query(
        `select public.remember_assistant_preference(
          'preferred_communication_style',
          '"concise"'::jsonb,
          1,
          'explicit'
        )`,
      )
      const removed = await client.query(
        `select public.forget_assistant_memory(
          'preferred_communication_style',
          false
        ) as result`,
      )
      const remaining = await client.query(
        `select count(*)::integer as count
         from public.assistant_memories
         where memory_key = 'preferred_communication_style'`,
      )

      expect(removed.rows[0].result).toMatchObject({ memoriesDeleted: 1 })
      expect(remaining.rows[0].count).toBe(0)
    } finally {
      await client.query('rollback')
    }

    await client.query('begin')
    try {
      await client.query('set local role anonymous')
      await expectPrivilegeDenied(
        client,
        `select public.forget_assistant_memory(null, true)`,
      )
    } finally {
      await client.query('rollback')
    }
  })

  it('stores P5 advice controls per authenticated account only', async () => {
    await client.query('begin')
    try {
      await setAuthenticatedRole(client, existingUserId)
      const preferences = {
        tone: 'brief', weeklySummary: true, unusualSpending: false,
        goalForecast: true, affordability: true, savingTips: true,
        recurringPayments: false,
      }
      const saved = await client.query(
        `select public.remember_assistant_preference(
          'advice_preferences', $1::jsonb, 1, 'explicit'
        ) as result`,
        [JSON.stringify(preferences)],
      )
      expect(saved.rows[0].result).toMatchObject({
        memory_key: 'advice_preferences',
        memory_value: preferences,
      })
    } finally {
      await client.query('rollback')
    }

    await client.query('begin')
    try {
      await client.query('set local role anonymous')
      await expectPrivilegeDenied(
        client,
        `select public.remember_assistant_preference(
          'advice_preferences', '{}'::jsonb, 1, 'explicit'
        )`,
      )
    } finally {
      await client.query('rollback')
    }
  })

  it('rejects pending actions whose expiry exceeds the short confirmation window', async () => {
    await client.query('begin')
    try {
      await setAuthenticatedRole(client, existingUserId)
      await expectDatabaseFailure(
        client,
        () => client.query(
          `select public.create_pending_finance_action(
            $1,
            'record_transactions',
            $2::jsonb,
            now() + interval '2 hours'
          )`,
          [
            `assistant-expiry-${crypto.randomUUID()}`,
            JSON.stringify({
              items: [{
                clientItemId: 'item-1',
                walletId: crypto.randomUUID(),
                transactionType: 'expense',
                amount: 10_000,
                description: 'Expiry test',
              }],
            }),
          ],
        ),
        /pending_finance_actions_expiry_window/i,
      )
    } finally {
      await client.query('rollback')
    }
  })

  it('executes a confirmed transaction once even after duplicate confirmation', async () => {
    await client.query('begin')
    try {
      const walletResult = await client.query(
        `insert into public.wallets (
          user_id, name, wallet_type, initial_balance, current_balance
        ) values ($1, $2, 'cash', 100000, 100000)
        returning id::text`,
        [existingUserId, `Assistant pending ${crypto.randomUUID()}`],
      )
      const walletId = walletResult.rows[0].id
      const idempotencyKey = `assistant-${crypto.randomUUID()}`
      const payload = {
        items: [{
          clientItemId: 'item-1',
          walletId,
          categoryId: null,
          transactionType: 'expense',
          amount: 20000,
          description: 'Makan',
          notes: null,
          occurredAt: null,
        }],
      }

      await setAuthenticatedRole(client, existingUserId)
      const staged = await client.query(
        `select public.create_pending_finance_action(
          $1,
          'record_transactions',
          $2::jsonb,
          now() + interval '15 minutes'
        ) as result`,
        [idempotencyKey, JSON.stringify(payload)],
      )
      const action = staged.rows[0].result
      const correctedPayload = {
        ...payload,
        items: payload.items.map((item) => ({
          ...item,
          amount: 25000,
        })),
      }
      const corrected = await client.query(
        `select public.correct_pending_finance_action(
          $1::uuid,
          $2,
          $3::jsonb
        ) as result`,
        [action.id, action.payload_hash, JSON.stringify(correctedPayload)],
      )
      const correctedAction = corrected.rows[0].result
      const first = await client.query(
        `select public.execute_assistant_pending_finance_action(
          $1::uuid,
          $2
        ) as result`,
        [correctedAction.id, correctedAction.payload_hash],
      )
      const replay = await client.query(
        `select public.execute_assistant_pending_finance_action(
          $1::uuid,
          $2
        ) as result`,
        [correctedAction.id, correctedAction.payload_hash],
      )
      const balance = await client.query(
        'select current_balance::numeric as balance from public.wallets where id = $1',
        [walletId],
      )
      const transactionCount = await client.query(
        'select count(*)::integer as count from public.transactions where wallet_id = $1',
        [walletId],
      )

      expect(first.rows[0].result).toMatchObject({ replayed: false })
      expect(replay.rows[0].result).toMatchObject({ replayed: true })
      expect(Number(balance.rows[0].balance)).toBe(75000)
      expect(transactionCount.rows[0].count).toBe(1)
    } finally {
      await client.query('rollback')
    }
  })

  it('updates an owned saving goal only after pending confirmation', async () => {
    await client.query('begin')
    try {
      const goalResult = await client.query(
        `insert into public.goals (
          user_id, name, target_amount, current_amount, status
        ) values ($1, $2, 5000000, 1000000, 'active')
        returning id::text`,
        [existingUserId, `Assistant goal ${crypto.randomUUID()}`],
      )
      const goalId = goalResult.rows[0].id
      const payload = {
        goalId,
        goal: 'Assistant goal',
        amount: 7_000_000,
        deadline: null,
      }

      await setAuthenticatedRole(client, existingUserId)
      const staged = await client.query(
        `select public.create_pending_finance_action(
          $1,
          'update_saving_goal',
          $2::jsonb,
          now() + interval '15 minutes'
        ) as result`,
        [`assistant-${crypto.randomUUID()}`, JSON.stringify(payload)],
      )
      const action = staged.rows[0].result
      const before = await client.query(
        'select target_amount::numeric as target from public.goals where id = $1',
        [goalId],
      )
      const executed = await client.query(
        `select public.execute_assistant_pending_finance_action(
          $1::uuid,
          $2
        ) as result`,
        [action.id, action.payload_hash],
      )
      const after = await client.query(
        'select target_amount::numeric as target from public.goals where id = $1',
        [goalId],
      )

      expect(Number(before.rows[0].target)).toBe(5_000_000)
      expect(executed.rows[0].result).toMatchObject({
        action_type: 'update_saving_goal',
        replayed: false,
      })
      expect(Number(after.rows[0].target)).toBe(7_000_000)
    } finally {
      await client.query('rollback')
    }
  })

  it('creates a wallet exactly once through a P1 pending action', async () => {
    await client.query('begin')
    try {
      await setAuthenticatedRole(client, existingUserId)
      const walletName = `P1 Wallet ${crypto.randomUUID()}`
      const staged = await client.query(
        `select public.create_pending_finance_action(
          $1,
          'create_wallet',
          $2::jsonb,
          now() + interval '15 minutes'
        ) as result`,
        [
          `assistant-${crypto.randomUUID()}`,
          JSON.stringify({
            walletName,
            initialBalance: 125000,
            walletType: 'bank',
          }),
        ],
      )
      const action = staged.rows[0].result
      const first = await client.query(
        `select public.execute_assistant_pending_finance_action($1::uuid, $2) as result`,
        [action.id, action.payload_hash],
      )
      const replay = await client.query(
        `select public.execute_assistant_pending_finance_action($1::uuid, $2) as result`,
        [action.id, action.payload_hash],
      )
      const count = await client.query(
        'select count(*)::integer as count from public.wallets where user_id = $1 and name = $2',
        [existingUserId, walletName],
      )

      expect(first.rows[0].result).toMatchObject({
        action_type: 'create_wallet',
        replayed: false,
      })
      expect(replay.rows[0].result).toMatchObject({ replayed: true })
      expect(count.rows[0].count).toBe(1)
    } finally {
      await client.query('rollback')
    }
  })

  it('moves money into a goal exactly once through a P1 pending action', async () => {
    await client.query('begin')
    try {
      const wallet = await client.query(
        `insert into public.wallets (
          user_id, name, wallet_type, initial_balance, current_balance
        ) values ($1, $2, 'cash', 500000, 500000)
        returning id::text`,
        [existingUserId, `P1 Source ${crypto.randomUUID()}`],
      )
      const goal = await client.query(
        `insert into public.goals (
          user_id, name, target_amount, current_amount, status
        ) values ($1, $2, 1000000, 0, 'active')
        returning id::text`,
        [existingUserId, `P1 Goal ${crypto.randomUUID()}`],
      )
      await setAuthenticatedRole(client, existingUserId)
      const staged = await client.query(
        `select public.create_pending_finance_action(
          $1,
          'deposit_goal',
          $2::jsonb,
          now() + interval '15 minutes'
        ) as result`,
        [
          `assistant-${crypto.randomUUID()}`,
          JSON.stringify({
            goalId: goal.rows[0].id,
            sourceWalletId: wallet.rows[0].id,
            amount: 100000,
          }),
        ],
      )
      const action = staged.rows[0].result
      await client.query(
        `select public.execute_assistant_pending_finance_action($1::uuid, $2)`,
        [action.id, action.payload_hash],
      )
      const replay = await client.query(
        `select public.execute_assistant_pending_finance_action($1::uuid, $2) as result`,
        [action.id, action.payload_hash],
      )
      const balances = await client.query(
        `select
          (select current_balance::numeric from public.wallets where id = $1) as wallet_balance,
          (select current_amount::numeric from public.goals where id = $2) as goal_amount`,
        [wallet.rows[0].id, goal.rows[0].id],
      )

      expect(replay.rows[0].result).toMatchObject({ replayed: true })
      expect(Number(balances.rows[0].wallet_balance)).toBe(400000)
      expect(Number(balances.rows[0].goal_amount)).toBe(100000)
    } finally {
      await client.query('rollback')
    }
  })

  it('isolates assistant rows by JWT subject and denies anonymous execution', async () => {
    await client.query('begin')
    try {
      await setAuthenticatedRole(client, crypto.randomUUID())
      const rows = await client.query('select id from public.pending_finance_actions')
      expect(rows.rowCount).toBe(0)
    } finally {
      await client.query('rollback')
    }

    await client.query('begin')
    try {
      await client.query('set local role anonymous')
      await expectPrivilegeDenied(client, 'select id from public.pending_finance_actions')
      await expectPrivilegeDenied(
        client,
        'select public.execute_assistant_pending_finance_action($1::uuid, $2)',
        [crypto.randomUUID(), 'invalid'],
      )
    } finally {
      await client.query('rollback')
    }
  })
})
