-- Run as the trusted DATABASE_URL role, never the browser's authenticated role.
-- Private schema is deliberately not exposed through Neon's public Data API.
create schema if not exists assistant_private;
revoke all on schema assistant_private from public;

create table if not exists assistant_private.provider_cooldowns (
  scope text primary key,
  next_attempt_at timestamptz not null
);
revoke all on assistant_private.provider_cooldowns from public;

-- No grants to anonymous/authenticated clients. Only the server owner uses this.
