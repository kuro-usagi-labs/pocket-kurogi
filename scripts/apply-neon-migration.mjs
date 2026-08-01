import fs from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'
import { migrationChecksum } from './migration-checksum.mjs'

const { Client } = pg

async function main() {
  const migrationPath = process.argv[2]
  if (!migrationPath || !process.env.TARGET_DATABASE_URL) {
    throw new Error('Usage: TARGET_DATABASE_URL=... node scripts/apply-neon-migration.mjs <file>')
  }

  const sql = await fs.readFile(migrationPath, 'utf8')
  const migrationName = path.basename(migrationPath)
  const checksum = migrationChecksum(sql)
  const client = new Client({
    connectionString: process.env.TARGET_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  try {
    await client.query('begin')
    const existing = await client.query(
      'select checksum from public.schema_migrations where name = $1 for update',
      [migrationName],
    )
    if (existing.rowCount > 0) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`Checksum migration ${migrationName} berbeda dari production.`)
      }
      await client.query('rollback')
      process.stdout.write(`${migrationName} already applied\n`)
      return
    }
    await client.query(sql)
    await client.query(
      `insert into public.schema_migrations (name, checksum)
       values ($1, $2)`,
      [migrationName, checksum],
    )
    await client.query('commit')
    process.stdout.write(`${migrationName} applied\n`)
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
