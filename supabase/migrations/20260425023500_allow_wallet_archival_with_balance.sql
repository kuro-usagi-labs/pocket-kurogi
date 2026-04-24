create or replace function public.archive_wallet_safely(
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
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into v_wallet
  from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false
  for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  update public.wallets
  set is_archived = true,
      updated_at = timezone('utc', now())
  where id = p_wallet_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'wallet_id', v_wallet.id,
    'wallet_name', v_wallet.name,
    'current_balance', coalesce(v_wallet.current_balance, 0),
    'archived', true
  );
end;
$$;

revoke all on function public.archive_wallet_safely(uuid) from public;
grant execute on function public.archive_wallet_safely(uuid) to authenticated, service_role;
