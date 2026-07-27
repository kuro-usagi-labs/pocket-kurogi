import fs from 'node:fs/promises'
import pg from 'pg'

const { Client } = pg
const MIGRATIONS_DIR = new URL('../neon/migrations/', import.meta.url)

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
    await client.query('begin')

    for (const migrationName of migrationNames) {
      const sql = await fs.readFile(new URL(migrationName, MIGRATIONS_DIR), 'utf8')

      try {
        await client.query(sql)
      } catch (error) {
        throw new Error(`${migrationName}: ${error.message}`)
      }
    }

    await client.query('commit')
    process.stdout.write(`${JSON.stringify({ migrationsApplied: migrationNames }, null, 2)}\n`)
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
