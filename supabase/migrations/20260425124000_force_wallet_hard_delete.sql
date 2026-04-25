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
  v_deleted_transactions integer := 0;
  v_deleted_wallet_rules integer := 0;
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

  if to_regclass('public.smart_wallet_rules') is not null then
    execute
      'delete from public.smart_wallet_rules where wallet_id = $1 and user_id = $2'
      using p_wallet_id, v_user_id;
    get diagnostics v_deleted_wallet_rules = row_count;
  end if;

  if to_regclass('public.transactions') is not null then
    execute
      'delete from public.transactions where wallet_id = $1 and user_id = $2'
      using p_wallet_id, v_user_id;
    get diagnostics v_deleted_transactions = row_count;
  end if;

  delete from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'wallet_id', v_wallet.id,
    'wallet_name', v_wallet.name,
    'deleted', true,
    'deleted_transactions', v_deleted_transactions,
    'deleted_wallet_rules', v_deleted_wallet_rules
  );
end;
$$;

revoke all on function public.delete_wallet_permanently_safe(uuid) from public;
grant execute on function public.delete_wallet_permanently_safe(uuid) to authenticated, service_role;

grant delete on table public.wallets to authenticated, service_role;

drop policy if exists "Users can delete own wallets" on public.wallets;

create policy "Users can delete own wallets" on public.wallets
  for delete
  using (auth.uid() = user_id);
