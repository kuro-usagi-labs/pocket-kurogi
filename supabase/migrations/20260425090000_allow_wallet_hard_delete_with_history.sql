create or replace function public.delete_wallet_permanently_safe(
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
  for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  delete from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'wallet_id', v_wallet.id,
    'wallet_name', v_wallet.name,
    'deleted', true
  );
end;
$$;

revoke all on function public.delete_wallet_permanently_safe(uuid) from public;
grant execute on function public.delete_wallet_permanently_safe(uuid) to authenticated, service_role;
