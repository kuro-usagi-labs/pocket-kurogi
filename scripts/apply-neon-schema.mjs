import fs from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

const { Client } = pg

const MIGRATIONS_DIR = new URL('../supabase/migrations/', import.meta.url)
const SKIPPED_MIGRATIONS = new Set([
  '20260413164316_fix_auth_triggers.sql',
])

const COMPATIBILITY_SQL = `
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$$;

create or replace function public.current_user_id()
returns uuid
language plpgsql
stable
as $$
declare
  direct_sub text;
  claims jsonb;
begin
  direct_sub := nullif(current_setting('request.jwt.claim.sub', true), '');
  if direct_sub is not null then
    return direct_sub::uuid;
  end if;

  begin
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    claims := null;
  end;

  return nullif(claims ->> 'sub', '')::uuid;
end;
$$;

grant execute on function public.current_user_id() to anonymous, authenticated, anon, service_role;
`

const FINALIZE_SQL = `
alter table public.chat_messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create or replace function public.handle_new_neon_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(new.name, ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_neon_user_created on neon_auth."user";
create trigger on_neon_user_created
  after insert on neon_auth."user"
  for each row execute function public.handle_new_neon_user();

grant usage on schema public to anonymous, authenticated;
grant select on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public
  grant select on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
`

function removeSupabaseAuthTrigger(sql) {
  return sql.replace(
    /create\s+trigger\s+on_auth_user_created[\s\S]*?execute\s+function\s+(?:public\.)?handle_new_user\(\)\s*;/gi,
    '',
  )
}

function transformMigration(filename, input) {
  if (SKIPPED_MIGRATIONS.has(filename)) {
    return ''
  }

  let sql = input.replaceAll(
    /references\s+auth\.users\s*\(\s*id\s*\)/gi,
    'references neon_auth."user"(id)',
  )

  sql = sql.replaceAll(/auth\.uid\(\)/gi, 'public.current_user_id()')
  sql = removeSupabaseAuthTrigger(sql)

  if (filename === '20260414223000_input_hardening_stage1.sql') {
    const storageMarker = 'insert into storage.buckets'
    const marker = 'create or replace function public.normalize_entity_name'
    const storageStart = sql.toLowerCase().indexOf(storageMarker)
    const start = sql.toLowerCase().indexOf(marker)
    if (storageStart === -1 || start === -1) {
      throw new Error(`Could not strip Supabase Storage section from ${filename}`)
    }
    sql = `${sql.slice(0, storageStart)}\n${sql.slice(start)}`
  }

  return sql
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
    await client.query('begin')
    await client.query(COMPATIBILITY_SQL)

    const migrationNames = (await fs.readdir(MIGRATIONS_DIR))
      .filter((name) => name.endsWith('.sql'))
      .sort()

    for (const migrationName of migrationNames) {
      const migrationPath = new URL(migrationName, MIGRATIONS_DIR)
      const original = await fs.readFile(migrationPath, 'utf8')
      const sql = transformMigration(migrationName, original)

      if (!sql.trim()) {
        continue
      }

      try {
        await client.query(sql)
      } catch (error) {
        throw new Error(`${migrationName}: ${error.message}`)
      }
    }

    await client.query(FINALIZE_SQL)
    await client.query('commit')

    const tables = await client.query(`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name
    `)

    process.stdout.write(`${JSON.stringify({
      migrationsApplied: migrationNames.length - SKIPPED_MIGRATIONS.size,
      tables: tables.rows.map((row) => row.table_name),
    }, null, 2)}\n`)
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
