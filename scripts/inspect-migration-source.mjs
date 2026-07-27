import pg from 'pg'

const { Client } = pg

function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

function createSourceClient() {
  return new Client({
    host: required('SOURCE_PGHOST'),
    port: Number(process.env.SOURCE_PGPORT || 5432),
    user: required('SOURCE_PGUSER'),
    password: required('SOURCE_PGPASSWORD'),
    database: process.env.SOURCE_PGDATABASE || 'postgres',
    ssl: { rejectUnauthorized: false },
  })
}

function createTargetClient() {
  return new Client({
    connectionString: required('TARGET_DATABASE_URL'),
    ssl: { rejectUnauthorized: false },
  })
}

async function tableCounts(client, schema, tables) {
  const counts = {}

  for (const table of tables) {
    const identifier = `"${schema.replaceAll('"', '""')}"."${table.replaceAll('"', '""')}"`
    const result = await client.query(`select count(*)::int as count from ${identifier}`)
    counts[table] = result.rows[0].count
  }

  return counts
}

async function main() {
  const source = createSourceClient()
  const target = createTargetClient()

  await Promise.all([source.connect(), target.connect()])

  try {
    const sourceTablesResult = await source.query(`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name
    `)
    const sourceTables = sourceTablesResult.rows.map((row) => row.table_name)

    const sourceColumnsResult = await source.query(`
      select table_name, column_name, data_type, udt_name, is_nullable
      from information_schema.columns
      where table_schema = 'public'
      order by table_name, ordinal_position
    `)

    const authUsersResult = await source.query('select count(*)::int as count from auth.users')
    const storageObjectsResult = await source.query('select count(*)::int as count from storage.objects')

    const targetTablesResult = await target.query(`
      select table_schema, table_name
      from information_schema.tables
      where table_schema in ('public', 'neon_auth', 'auth')
      order by table_schema, table_name
    `)

    const result = {
      source: {
        tables: sourceTables,
        columns: sourceColumnsResult.rows,
        rowCounts: await tableCounts(source, 'public', sourceTables),
        authUsers: authUsersResult.rows[0].count,
        storageObjects: storageObjectsResult.rows[0].count,
      },
      target: {
        tables: targetTablesResult.rows,
      },
    }

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } finally {
    await Promise.allSettled([source.end(), target.end()])
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
