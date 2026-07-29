-- Migration metadata is deployment infrastructure, not application data.
-- Only the database owner used by the migration runner may access it.
revoke all privileges on table public.schema_migrations
  from public, anon, anonymous, authenticated, service_role;

notify pgrst, 'reload schema';
