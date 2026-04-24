create or replace function public.restore_wallet_safely(
  p_wallet_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet public.wallets%rowtype;
  v_normalized_name text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into v_wallet
  from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = true
  for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  v_normalized_name := public.normalize_entity_name(v_wallet.name);

  if exists (
    select 1
    from public.wallets
    where user_id = v_user_id
      and id <> p_wallet_id
      and coalesce(is_archived, false) = false
      and public.normalize_entity_name(name) = v_normalized_name
  ) then
    raise exception 'Wallet name is already in use';
  end if;

  update public.wallets
  set is_archived = false,
      updated_at = timezone('utc', now())
  where id = p_wallet_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'wallet_id', v_wallet.id,
    'wallet_name', v_wallet.name,
    'restored', true
  );
end;
$$;

revoke all on function public.restore_wallet_safely(uuid) from public;
grant execute on function public.restore_wallet_safely(uuid) to authenticated, service_role;
