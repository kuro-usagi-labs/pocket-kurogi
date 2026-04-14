drop policy if exists "Users can delete own wallets" on public.wallets;

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

  if coalesce(v_wallet.current_balance, 0) <> 0 then
    raise exception 'Wallet masih memiliki saldo. Pindahkan atau nolkan dulu sebelum diarsipkan.';
  end if;

  update public.wallets
  set is_archived = true,
      updated_at = timezone('utc', now())
  where id = p_wallet_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'wallet_id', v_wallet.id,
    'wallet_name', v_wallet.name,
    'archived', true
  );
end;
$$;

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

  if coalesce(v_wallet.current_balance, 0) <> 0 then
    raise exception 'Wallet masih memiliki saldo dan tidak bisa dihapus permanen.';
  end if;

  if exists (
    select 1
    from public.transactions
    where wallet_id = p_wallet_id
      and user_id = v_user_id
    limit 1
  ) then
    raise exception 'Wallet dengan riwayat ledger tidak bisa dihapus permanen. Arsipkan saja jika sudah tidak dipakai.';
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

revoke all on function public.archive_wallet_safely(uuid) from public;
revoke all on function public.delete_wallet_permanently_safe(uuid) from public;

grant execute on function public.archive_wallet_safely(uuid) to authenticated, service_role;
grant execute on function public.delete_wallet_permanently_safe(uuid) to authenticated, service_role;
