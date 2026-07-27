import fs from 'node:fs/promises'
import pg from 'pg'

const { Client } = pg

async function main() {
  const migrationPath = process.argv[2]
  if (!migrationPath || !process.env.TARGET_DATABASE_URL) {
    throw new Error('Usage: TARGET_DATABASE_URL=... node scripts/apply-neon-migration.mjs <file>')
  }

  const sql = await fs.readFile(migrationPath, 'utf8')
  const client = new Client({
    connectionString: process.env.TARGET_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  try {
    await client.query('begin')
    await client.query(sql)
    await client.query('commit')
    process.stdout.write(`${migrationPath} applied\n`)
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
