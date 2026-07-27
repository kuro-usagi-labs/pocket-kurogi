import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const execFileAsync = promisify(execFile)
const { Client } = pg

const BUCKET = 'chat-attachments'
const NEONCTL =
  'C:\\Users\\toshiba\\AppData\\Roaming\\npm\\neonctl.cmd'

function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

async function listObjects(storage, prefix = '') {
  const objects = []
  let offset = 0

  while (true) {
    const { data, error } = await storage.list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })

    if (error) {
      throw error
    }

    for (const entry of data || []) {
      const key = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.id) {
        objects.push({
          key,
          contentType: entry.metadata?.mimetype || 'application/octet-stream',
        })
      } else {
        objects.push(...await listObjects(storage, key))
      }
    }

    if (!data || data.length < 1000) {
      return objects
    }

    offset += 1000
  }
}

async function main() {
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
    throw new Error(`Expected one source user, found ${sourceUsers.users.length}`)
  }

  const sourceUser = sourceUsers.users[0]
  const target = new Client({
    connectionString: required('TARGET_DATABASE_URL'),
    ssl: { rejectUnauthorized: false },
  })
  await target.connect()

  let targetUserId
  try {
    const targetUsers = await target.query(
      'select id::text from neon_auth."user" where lower(email) = lower($1)',
      [sourceUser.email],
    )
    if (targetUsers.rowCount !== 1) {
      throw new Error(`Expected one target user, found ${targetUsers.rowCount}`)
    }
    targetUserId = targetUsers.rows[0].id
  } finally {
    await target.end()
  }

  const storage = supabase.storage.from(BUCKET)
  const objects = await listObjects(storage)
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'pocket-kurogi-storage-'))
  let uploaded = 0

  try {
    for (const [index, object] of objects.entries()) {
      const { data, error } = await storage.download(object.key)
      if (error) {
        throw new Error(`${object.key}: ${error.message}`)
      }

      const localPath = path.join(tempDirectory, `object-${index}`)
      await fs.writeFile(localPath, Buffer.from(await data.arrayBuffer()))

      const targetKey = object.key.startsWith(`${sourceUser.id}/`)
        ? `${targetUserId}/${object.key.slice(sourceUser.id.length + 1)}`
        : object.key

      await execFileAsync(NEONCTL, [
        'buckets',
        'object',
        'put',
        `${BUCKET}/${targetKey}`,
        '--project-id',
        'young-cloud-55803831',
        '--branch',
        'production',
        '--file',
        localPath,
        '--content-type',
        object.contentType,
        '--no-color',
      ])

      uploaded += 1
    }
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true })
  }

  process.stdout.write(`${JSON.stringify({
    discovered: objects.length,
    uploaded,
  }, null, 2)}\n`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
