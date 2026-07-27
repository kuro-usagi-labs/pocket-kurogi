import { createClient } from '@supabase/supabase-js'

const TABLES = [
  'profiles',
  'wallets',
  'categories',
  'transactions',
  'smart_category_rules',
  'smart_wallet_rules',
  'goals',
  'budgets',
  'chat_messages',
]

function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

async function countAuthUsers(client) {
  let page = 1
  let count = 0

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 1000,
    })

    if (error) {
      throw error
    }

    const users = data?.users || []
    count += users.length

    if (users.length < 1000) {
      return count
    }

    page += 1
  }
}

async function main() {
  const client = createClient(
    required('SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )

  const rowCounts = {}

  for (const table of TABLES) {
    const { count, error } = await client
      .from(table)
      .select('*', { count: 'exact', head: true })

    if (error) {
      throw new Error(`${table}: ${error.message}`)
    }

    rowCounts[table] = count || 0
  }

  const { data: buckets, error: bucketError } = await client.storage.listBuckets()
  if (bucketError) {
    throw bucketError
  }

  const result = {
    rowCounts,
    authUsers: await countAuthUsers(client),
    buckets: (buckets || []).map((bucket) => ({
      id: bucket.id,
      name: bucket.name,
      public: bucket.public,
    })),
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
