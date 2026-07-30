import fs from 'node:fs/promises'
import pg from 'pg'
import {
  migrationChecksum,
  migrationChecksumStatus,
} from './migration-checksum.mjs'

const { Client } = pg
const MIGRATIONS_DIR = new URL('../neon/migrations/', import.meta.url)
const USER_TABLES = [
  'profiles',
  'wallets',
  'categories',
  'transactions',
  'goals',
  'budgets',
  'smart_category_rules',
  'smart_wallet_rules',
  'chat_messages',
  'chat_attachments',
]

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
    const findings = []
    const addFinding = (severity, code, detail) => findings.push({ severity, code, detail })

    const { rows: tableRows } = await client.query(`
      select c.relname as table_name,
             c.relrowsecurity as rls_enabled,
             c.relforcerowsecurity as rls_forced
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')
      order by c.relname
    `)
    const tableMap = new Map(tableRows.map((row) => [row.table_name, row]))

    for (const table of USER_TABLES) {
      const metadata = tableMap.get(table)
      if (!metadata) {
        addFinding('critical', 'missing_table', table)
        continue
      }
      if (!metadata.rls_enabled) addFinding('critical', 'rls_disabled', table)
    }

    const { rows: policyRows } = await client.query(`
      select tablename as table_name,
             count(*)::int as policy_count,
             array_agg(distinct cmd order by cmd) as commands
      from pg_catalog.pg_policies
      where schemaname = 'public'
      group by tablename
      order by tablename
    `)
    const policyMap = new Map(policyRows.map((row) => [row.table_name, row]))
    for (const table of USER_TABLES.filter((name) => tableMap.has(name))) {
      if (!policyMap.has(table)) addFinding('critical', 'missing_rls_policy', table)
    }

    const { rows: functionRows } = await client.query(`
      select p.proname as function_name,
             p.prosecdef as security_definer,
             coalesce(array_to_string(p.proconfig, ','), '') as configuration
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
      order by p.proname
    `)
    for (const fn of functionRows.filter((row) => row.security_definer)) {
      if (!fn.configuration.includes('search_path=')) {
        addFinding('critical', 'unsafe_security_definer_search_path', fn.function_name)
      }
    }

    const { rows: publicExecuteRows } = await client.query(`
      select p.proname as function_name
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and has_function_privilege('public', p.oid, 'execute')
      order by p.proname
    `)
    for (const row of publicExecuteRows) {
      addFinding('warning', 'function_executable_by_public', row.function_name)
    }

    const { rows: broadGrantRows } = await client.query(`
      select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) as privileges
      from information_schema.role_table_grants
      where table_schema = 'public'
        and grantee in ('PUBLIC', 'anon', 'anonymous')
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
      group by grantee, table_name
      order by grantee, table_name
    `)
    for (const row of broadGrantRows) {
      addFinding('warning', 'anonymous_write_grant', `${row.grantee}:${row.table_name}:${row.privileges}`)
    }

    const { rows: migrationGrantRows } = await client.query(`
      select grantee, string_agg(privilege_type, ',' order by privilege_type) as privileges
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'schema_migrations'
        and grantee in ('PUBLIC', 'anon', 'anonymous', 'authenticated', 'service_role')
      group by grantee
      order by grantee
    `)
    for (const row of migrationGrantRows) {
      addFinding('critical', 'untrusted_migration_tracking_grant', `${row.grantee}:${row.privileges}`)
    }

    const { rows: schemaCreateRows } = await client.query(`
      select coalesce(r.rolname, 'PUBLIC') as role_name
      from pg_catalog.pg_namespace n
      cross join lateral pg_catalog.aclexplode(
        coalesce(n.nspacl, pg_catalog.acldefault('n', n.nspowner))
      ) acl
      left join pg_catalog.pg_roles r on r.oid = acl.grantee
      where n.nspname = 'public'
        and acl.privilege_type = 'CREATE'
        and (acl.grantee = 0 or r.rolname in ('anon', 'anonymous', 'authenticated', 'service_role'))
      order by role_name
    `)
    for (const row of schemaCreateRows) {
      addFinding('critical', 'untrusted_public_schema_create', row.role_name)
    }

    const migrationFiles = (await fs.readdir(MIGRATIONS_DIR))
      .filter((name) => name.endsWith('.sql'))
      .sort()
    const localMigrations = new Map()
    for (const name of migrationFiles) {
      localMigrations.set(
        name,
        migrationChecksum(await fs.readFile(new URL(name, MIGRATIONS_DIR), 'utf8')),
      )
    }

    let appliedMigrations = []
    if (tableMap.has('schema_migrations')) {
      const { rows } = await client.query('select name, checksum from public.schema_migrations order by name')
      appliedMigrations = rows
      for (const row of rows) {
        if (!localMigrations.has(row.name)) addFinding('warning', 'database_only_migration', row.name)
        else {
          const checksumStatus = migrationChecksumStatus(
            row.name,
            row.checksum,
            localMigrations.get(row.name),
          )
          if (checksumStatus === 'mismatch') {
            addFinding('critical', 'migration_checksum_mismatch', row.name)
          } else if (checksumStatus === 'legacy-compatible') {
            addFinding('warning', 'legacy_migration_checksum_accepted', row.name)
          }
        }
      }
      for (const name of migrationFiles) {
        if (!rows.some((row) => row.name === name)) addFinding('warning', 'pending_migration', name)
      }
    } else {
      addFinding('warning', 'migration_tracking_missing', 'public.schema_migrations')
    }

    const rowCounts = {}
    for (const table of USER_TABLES.filter((name) => tableMap.has(name))) {
      const { rows: [{ count }] } = await client.query(`select count(*)::int as count from public.${table}`)
      rowCounts[table] = count
    }

    const orphanChecks = [
      ['wallet_without_profile', 'wallets w', 'profiles p', 'p.id = w.user_id'],
      ['category_without_profile', 'categories c', 'profiles p', 'p.id = c.user_id'],
      ['transaction_without_profile', 'transactions t', 'profiles p', 'p.id = t.user_id'],
      ['transaction_without_wallet', 'transactions t', 'wallets w', 'w.id = t.wallet_id'],
      // A transaction may intentionally be uncategorized. Only a non-null
      // category reference can be orphaned.
      ['transaction_without_category', 'transactions t', 'categories c', 'c.id = t.category_id', 't.category_id is not null'],
      ['goal_without_profile', 'goals g', 'profiles p', 'p.id = g.user_id'],
      ['budget_without_profile', 'budgets b', 'profiles p', 'p.id = b.user_id'],
      ['budget_without_category', 'budgets b', 'categories c', 'c.id = b.category_id'],
      ['category_rule_without_profile', 'smart_category_rules r', 'profiles p', 'p.id = r.user_id'],
      ['wallet_rule_without_profile', 'smart_wallet_rules r', 'profiles p', 'p.id = r.user_id'],
      ['message_without_profile', 'chat_messages m', 'profiles p', 'p.id = m.user_id'],
      ['attachment_without_profile', 'chat_attachments a', 'profiles p', 'p.id = a.user_id'],
    ]
    for (const [code, source, target, predicate, sourceFilter = 'true'] of orphanChecks) {
      const sourceTable = source.split(' ')[0]
      const targetTable = target.split(' ')[0]
      if (!tableMap.has(sourceTable) || !tableMap.has(targetTable)) continue
      const { rows: [{ count }] } = await client.query(
        `select count(*)::int as count from public.${source} where ${sourceFilter} and not exists (select 1 from public.${target} where ${predicate})`
      )
      if (count > 0) addFinding('critical', code, count)
    }

    const ownershipChecks = [
      ['transaction_wallet_owner_mismatch', 'transactions t join public.wallets w on w.id = t.wallet_id', 't.user_id <> w.user_id'],
      ['transaction_category_owner_mismatch', 'transactions t join public.categories c on c.id = t.category_id', 't.user_id <> c.user_id'],
      ['budget_category_owner_mismatch', 'budgets b join public.categories c on c.id = b.category_id', 'b.user_id <> c.user_id'],
      ['category_rule_owner_mismatch', 'smart_category_rules r join public.categories c on c.id = r.category_id', 'r.user_id <> c.user_id'],
      ['wallet_rule_owner_mismatch', 'smart_wallet_rules r join public.wallets w on w.id = r.wallet_id', 'r.user_id <> w.user_id'],
    ]
    for (const [code, source, predicate] of ownershipChecks) {
      const { rows: [{ count }] } = await client.query(
        `select count(*)::int as count from public.${source} where ${predicate}`
      )
      if (count > 0) addFinding('critical', code, count)
    }

    const validityChecks = [
      ['non_positive_transaction_amount', 'transactions', 'amount <= 0'],
      ['non_positive_budget_limit', 'budgets', 'monthly_limit <= 0'],
      ['invalid_goal_progress', 'goals', 'current_amount < 0 or current_amount > target_amount'],
      ['invalid_category_rule_usage', 'smart_category_rules', 'usage_count < 1'],
      ['invalid_wallet_rule_usage', 'smart_wallet_rules', 'usage_count < 1'],
    ]
    for (const [code, table, predicate] of validityChecks) {
      const { rows: [{ count }] } = await client.query(
        `select count(*)::int as count from public.${table} where ${predicate}`
      )
      if (count > 0) addFinding('warning', code, count)
    }

    const duplicateChecks = [
      ['duplicate_wallet_names', 'wallets', "lower(regexp_replace(trim(name), '\\s+', ' ', 'g'))", 'user_id'],
      ['duplicate_category_names', 'categories', "lower(regexp_replace(trim(name), '\\s+', ' ', 'g'))", 'user_id, category_type'],
      ['duplicate_goal_names', 'goals', "lower(regexp_replace(trim(name), '\\s+', ' ', 'g'))", 'user_id'],
    ]
    for (const [code, table, normalizedName, ownerColumns] of duplicateChecks) {
      const { rows: [{ count }] } = await client.query(`
        select count(*)::int as count
        from (
          select ${ownerColumns}, ${normalizedName}
          from public.${table}
          group by ${ownerColumns}, ${normalizedName}
          having count(*) > 1
        ) duplicates
      `)
      if (count > 0) addFinding('warning', code, count)
    }

    const { rows: authRows } = await client.query(`
      select
        (select count(*)::int from neon_auth."user") as auth_users,
        (select count(*)::int from public.profiles) as profiles,
        (select count(*)::int
           from neon_auth."user" u
          where not exists (select 1 from public.profiles p where p.id = u.id)) as auth_users_without_profile,
        (select count(*)::int
           from public.profiles p
          where not exists (select 1 from neon_auth."user" u where u.id = p.id)) as profiles_without_auth_user
    `)
    if (authRows[0].auth_users_without_profile > 0) {
      addFinding('critical', 'auth_users_without_profile', authRows[0].auth_users_without_profile)
    }
    if (authRows[0].profiles_without_auth_user > 0) {
      addFinding('critical', 'profiles_without_auth_user', authRows[0].profiles_without_auth_user)
    }

    const { rows: triggerRows } = await client.query(`
      select event_object_schema as schema_name,
             event_object_table as table_name,
             trigger_name,
             string_agg(event_manipulation, ',' order by event_manipulation) as events
      from information_schema.triggers
      where event_object_schema in ('public', 'neon_auth')
      group by event_object_schema, event_object_table, trigger_name
      order by event_object_schema, event_object_table, trigger_name
    `)

    const summary = {
      ok: !findings.some((finding) => finding.severity === 'critical'),
      database: {
        tables: tableRows.map((row) => row.table_name),
        rls_forced_tables: tableRows
          .filter((row) => row.rls_forced)
          .map((row) => row.table_name),
        row_counts: rowCounts,
        auth_counts: authRows[0],
      },
      migrations: {
        local: migrationFiles.length,
        applied: appliedMigrations.length,
      },
      public_schema_create_roles: schemaCreateRows.map((row) => row.role_name),
      policies: policyRows,
      security_definer_functions: functionRows.filter((row) => row.security_definer),
      triggers: triggerRows,
      findings,
    }

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
    if (!summary.ok) process.exitCode = 2
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
