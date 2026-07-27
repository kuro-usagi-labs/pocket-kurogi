-- Resolve Neon Auth identity with the function owner's access to the protected
-- auth schema. The function accepts no input and only returns the current JWT's
-- subject, so callers cannot use the elevated context to read auth tables.
create or replace function public.current_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, auth
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

revoke all on function public.current_user_id() from public;
grant execute on function public.current_user_id() to anonymous, authenticated, anon, service_role;
