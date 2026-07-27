import pg from 'pg'

const { Client } = pg

async function main() {
  const client = new Client({
    connectionString: process.env.TARGET_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()

  try {
    const tables = await client.query(`
      select table_schema, table_name
      from information_schema.tables
      where table_schema in ('public', 'neon_auth', 'auth')
      order by table_schema, table_name
    `)
    const columns = await client.query(`
      select table_schema, table_name, column_name, data_type, udt_name
      from information_schema.columns
      where table_schema in ('neon_auth', 'auth')
      order by table_schema, table_name, ordinal_position
    `)

    const authTables = tables.rows.filter((row) => row.table_schema === 'neon_auth')
    const authCounts = {}

    for (const table of authTables) {
      const identifier = `"neon_auth"."${table.table_name.replaceAll('"', '""')}"`
      const result = await client.query(`select count(*)::int as count from ${identifier}`)
      authCounts[table.table_name] = result.rows[0].count
    }

    const userTable = authTables.find((table) =>
      ['user', 'users', 'users_sync'].includes(table.table_name),
    )
    let userIds = []

    if (userTable) {
      const identifier = `"neon_auth"."${userTable.table_name.replaceAll('"', '""')}"`
      const idResult = await client.query(`select id::text from ${identifier} order by id`)
      userIds = idResult.rows.map((row) => row.id)
    }

    process.stdout.write(`${JSON.stringify({
      tables: tables.rows,
      columns: columns.rows,
      authCounts,
      userIds,
    }, null, 2)}\n`)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
