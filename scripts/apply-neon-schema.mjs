import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import pg from 'pg'

const { Client } = pg
const MIGRATIONS_DIR = new URL('../neon/migrations/', import.meta.url)
const LEGACY_BASELINE_CUTOFF = '20260727170000_create_chat_attachments.sql'

function checksum(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

async function main() {
  if (!process.env.TARGET_DATABASE_URL) {
    throw new Error('TARGET_DATABASE_URL is required')
  }

  const migrationNames = (await fs.readdir(MIGRATIONS_DIR))
    .filter((name) => name.endsWith('.sql'))
    .sort()
  const client = new Client({
    connectionString: process.env.TARGET_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()

  try {
    await client.query(`
      create table if not exists public.schema_migrations (
        name text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `)

    const { rows: migrationRows } = await client.query(
      'select name, checksum from public.schema_migrations order by name'
    )
    const appliedMigrations = new Map(
      migrationRows.map((migration) => [migration.name, migration.checksum])
    )

    // Databases created before migration tracking already contain the two original
    // migrations. Record that baseline once, then continue with newer migrations.
    if (appliedMigrations.size === 0) {
      const { rows: [{ exists: hasExistingSchema }] } = await client.query(
        "select to_regclass('public.profiles') is not null as exists"
      )

      if (hasExistingSchema) {
        for (const migrationName of migrationNames.filter(
          (name) => name <= LEGACY_BASELINE_CUTOFF
        )) {
          const sql = await fs.readFile(new URL(migrationName, MIGRATIONS_DIR), 'utf8')
          const migrationChecksum = checksum(sql)
          await client.query(
            'insert into public.schema_migrations (name, checksum) values ($1, $2)',
            [migrationName, migrationChecksum]
          )
          appliedMigrations.set(migrationName, migrationChecksum)
        }
      }
    }

    const migrationsApplied = []

    for (const migrationName of migrationNames) {
      const sql = await fs.readFile(new URL(migrationName, MIGRATIONS_DIR), 'utf8')
      const migrationChecksum = checksum(sql)
      const appliedChecksum = appliedMigrations.get(migrationName)

      if (appliedChecksum) {
        if (appliedChecksum !== migrationChecksum) {
          throw new Error(`${migrationName}: checksum changed after it was applied`)
        }
        continue
      }

      try {
        await client.query('begin')
        await client.query(sql)
        await client.query(
          'insert into public.schema_migrations (name, checksum) values ($1, $2)',
          [migrationName, migrationChecksum]
        )
        await client.query('commit')
        migrationsApplied.push(migrationName)
      } catch (error) {
        await client.query('rollback')
        throw new Error(`${migrationName}: ${error.message}`)
      }
    }

    process.stdout.write(`${JSON.stringify({ migrationsApplied }, null, 2)}\n`)
  } catch (error) {
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
