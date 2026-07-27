import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const { Client } = pg

const TABLE_ORDER = [
  'profiles',
  'wallets',
  'categories',
  'goals',
  'budgets',
  'smart_category_rules',
  'smart_wallet_rules',
  'transactions',
  'chat_messages',
]

function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

async function readAllRows(client, table) {
  const rows = []
  const pageSize = 500

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .range(start, start + pageSize - 1)

    if (error) {
      throw new Error(`${table}: ${error.message}`)
    }

    rows.push(...(data || []))

    if (!data || data.length < pageSize) {
      return rows
    }
  }
}

function transformRow(row, table, sourceUserId, targetUserId) {
  const transformed = { ...row }

  if (table === 'profiles' && transformed.id === sourceUserId) {
    transformed.id = targetUserId
  }

  if (transformed.user_id === sourceUserId) {
    transformed.user_id = targetUserId
  }

  if (
    typeof transformed.attachment_path === 'string' &&
    transformed.attachment_path.startsWith(`${sourceUserId}/`)
  ) {
    transformed.attachment_path =
      `${targetUserId}/${transformed.attachment_path.slice(sourceUserId.length + 1)}`
  }

  return transformed
}

async function insertRows(client, table, rows) {
  for (const row of rows) {
    const columns = Object.keys(row)
    const values = columns.map((column) => row[column])
    const placeholders = columns.map((_, index) => `$${index + 1}`)
    const sql = `
      insert into public.${quoteIdentifier(table)}
        (${columns.map(quoteIdentifier).join(', ')})
      values (${placeholders.join(', ')})
    `
    await client.query(sql, values)
  }
}

async function main() {
  if (process.env.ALLOW_TARGET_REPLACE !== 'true') {
    throw new Error('Set ALLOW_TARGET_REPLACE=true to replace Pocket Kurogi target data')
  }

  const supabase = createClient(
    required('SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )

  const { data: sourceUsers, error: sourceUsersError } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 10 })

  if (sourceUsersError) {
    throw sourceUsersError
  }

  if (sourceUsers.users.length !== 1) {
    throw new Error(`Expected exactly one source user, found ${sourceUsers.users.length}`)
  }

  const sourceUser = sourceUsers.users[0]
  const target = new Client({
    connectionString: required('TARGET_DATABASE_URL'),
    ssl: { rejectUnauthorized: false },
  })

  await target.connect()

  try {
    const targetUsers = await target.query(
      'select id::text from neon_auth."user" where lower(email) = lower($1)',
      [sourceUser.email],
    )

    if (targetUsers.rowCount !== 1) {
      throw new Error(`Expected one matching Neon Auth user, found ${targetUsers.rowCount}`)
    }

    const targetUserId = targetUsers.rows[0].id
    const sourceData = {}

    for (const table of TABLE_ORDER) {
      sourceData[table] = await readAllRows(supabase, table)
    }

    await target.query('begin')
    await target.query(`
      alter table public.chat_messages
        add column if not exists metadata jsonb not null default '{}'::jsonb
    `)
    await target.query(
      `truncate table ${TABLE_ORDER.map((table) => `public.${quoteIdentifier(table)}`).join(', ')} cascade`,
    )
    await target.query(
      'alter table public.profiles disable trigger on_profile_created_seed_categories',
    )

    const inserted = {}

    for (const table of TABLE_ORDER) {
      const rows = sourceData[table].map((row) =>
        transformRow(row, table, sourceUser.id, targetUserId),
      )
      await insertRows(target, table, rows)
      inserted[table] = rows.length
    }

    await target.query(
      'alter table public.profiles enable trigger on_profile_created_seed_categories',
    )
    await target.query('commit')

    process.stdout.write(`${JSON.stringify({
      sourceUserId: sourceUser.id,
      targetUserId,
      inserted,
    }, null, 2)}\n`)
  } catch (error) {
    await target.query('rollback')
    throw error
  } finally {
    await target.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
