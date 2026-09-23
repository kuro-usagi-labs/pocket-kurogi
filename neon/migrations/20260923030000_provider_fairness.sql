-- Server-only provider accounting. No API keys or message contents are stored.
create table if not exists assistant_private.provider_recovery (
  scope text primary key, recover_at timestamptz not null default now()
);
create table if not exists assistant_private.provider_user_usage (
  scope text not null, user_id uuid not null, window_start timestamptz not null,
  used integer not null check (used between 0 and 10), primary key(scope, user_id)
);
create table if not exists assistant_private.provider_leases (
  scope text not null, token uuid primary key, expires_at timestamptz not null
);
revoke all on assistant_private.provider_recovery, assistant_private.provider_user_usage,
  assistant_private.provider_leases from public, authenticated;

create or replace function assistant_private.acquire_provider_slot(p_scope text, p_user uuid, p_token uuid)
returns text language plpgsql set search_path = pg_catalog, assistant_private as $$
declare recovery timestamptz; count_used integer;
begin
  if p_user is null then return 'unauthenticated'; end if;
  insert into provider_recovery(scope) values(p_scope) on conflict do nothing;
  select recover_at into recovery from provider_recovery where scope=p_scope for update;
  if recovery > clock_timestamp() then return 'cooldown'; end if;
  delete from provider_leases where scope=p_scope and expires_at <= clock_timestamp();
  if (select count(*) from provider_leases where scope=p_scope) >= 2 then return 'capacity'; end if;
  insert into provider_user_usage(scope,user_id,window_start,used)
  values(p_scope,p_user,date_trunc('minute',clock_timestamp()),1)
  on conflict(scope,user_id) do update set
    used=case when provider_user_usage.window_start < date_trunc('minute',clock_timestamp()) then 1 else provider_user_usage.used+1 end,
    window_start=date_trunc('minute',clock_timestamp())
  where provider_user_usage.window_start < date_trunc('minute',clock_timestamp()) or provider_user_usage.used < 10
  returning used into count_used;
  if count_used is null then return 'user_rate_limit'; end if;
  insert into provider_leases(scope,token,expires_at) values(p_scope,p_token,clock_timestamp()+interval '15 seconds');
  return 'acquired';
end $$;

create or replace function assistant_private.release_provider_slot(p_scope text, p_token uuid, p_delay_ms integer)
returns void language plpgsql set search_path = pg_catalog, assistant_private as $$
begin
  -- Same lock order as acquire. Success never clears another worker's failure.
  perform 1 from provider_recovery where scope=p_scope for update;
  delete from provider_leases where scope=p_scope and token=p_token;
  if found and p_delay_ms > 0 then
    update provider_recovery set recover_at=greatest(recover_at,clock_timestamp()+least(p_delay_ms,86400000)*interval '1 millisecond') where scope=p_scope;
  end if;
end $$;
revoke all on function assistant_private.acquire_provider_slot(text,uuid,uuid),
  assistant_private.release_provider_slot(text,uuid,integer) from public, authenticated;
