-- Prefer the identity exposed by Neon Data API while retaining the standard
-- PostgREST claim fallback for compatibility with existing sessions.
create or replace function public.current_user_id()
returns uuid
language plpgsql
stable
set search_path = public, auth
as $$
declare
  neon_user_id text;
  direct_sub text;
  claims jsonb;
begin
  begin
    neon_user_id := nullif(auth.user_id(), '');
  exception when others then
    neon_user_id := null;
  end;

  if neon_user_id is not null then
    return neon_user_id::uuid;
  end if;

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
