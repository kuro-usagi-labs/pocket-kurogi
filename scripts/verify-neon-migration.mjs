import pg from 'pg'

const { Client } = pg

const expectedCounts = {
  profiles: 1,
  wallets: 3,
  categories: 35,
  transactions: 41,
  smart_category_rules: 14,
  smart_wallet_rules: 40,
  goals: 1,
  budgets: 0,
  chat_messages: 247,
  chat_attachments: 0,
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

async function main() {
  if (!process.env.TARGET_DATABASE_URL) {
    throw new Error('TARGET_DATABASE_URL is required')
  }

  const client = new Client({
    connectionString: process.env.TARGET_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()

  try {
    const actualCounts = {}

    for (const table of Object.keys(expectedCounts)) {
      const result = await client.query(
        `select count(*)::int as count from public.${quoteIdentifier(table)}`,
      )
      actualCounts[table] = result.rows[0].count
    }

    const mismatches = Object.entries(expectedCounts)
      .filter(([table, expected]) => actualCounts[table] !== expected)
      .map(([table, expected]) => ({
        table,
        expected,
        actual: actualCounts[table],
      }))

    const authResult = await client.query(
      'select count(*)::int as count from neon_auth."user"',
    )
    const authUsers = authResult.rows[0].count

    process.stdout.write(
      `${JSON.stringify({
        ok: mismatches.length === 0 && authUsers === 1,
        expectedCounts,
        actualCounts,
        authUsers,
        mismatches,
      }, null, 2)}\n`,
    )

    if (mismatches.length > 0 || authUsers !== 1) {
      process.exitCode = 1
    }
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
