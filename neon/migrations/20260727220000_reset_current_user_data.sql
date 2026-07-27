-- Reset all application data for the authenticated user while preserving the
-- Neon Auth account and active login session.
create or replace function public.reset_current_user_data()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_display_name text;
  v_deleted_records integer := 0;
  v_deleted_rows integer := 0;
  v_wallet_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Serialize resets for one account and make the whole operation atomic.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  select coalesce(nullif(trim(auth_user.name), ''), split_part(auth_user.email, '@', 1))
    into v_display_name
  from neon_auth."user" as auth_user
  where auth_user.id = v_user_id;

  if not found then
    raise exception 'Auth user not found';
  end if;

  delete from public.chat_attachments where user_id = v_user_id;
  get diagnostics v_deleted_rows = row_count;
  v_deleted_records := v_deleted_records + v_deleted_rows;

  delete from public.chat_messages where user_id = v_user_id;
  get diagnostics v_deleted_rows = row_count;
  v_deleted_records := v_deleted_records + v_deleted_rows;

  delete from public.budgets where user_id = v_user_id;
  get diagnostics v_deleted_rows = row_count;
  v_deleted_records := v_deleted_records + v_deleted_rows;

  delete from public.goals where user_id = v_user_id;
  get diagnostics v_deleted_rows = row_count;
  v_deleted_records := v_deleted_records + v_deleted_rows;

  -- These records are children of profiles. Deleting the profile clears
  -- wallets, categories, transactions, and learned rules through cascades.
  select v_deleted_records
    + (select count(*) from public.transactions where user_id = v_user_id)
    + (select count(*) from public.smart_category_rules where user_id = v_user_id)
    + (select count(*) from public.smart_wallet_rules where user_id = v_user_id)
    + (select count(*) from public.wallets where user_id = v_user_id)
    + (select count(*) from public.categories where user_id = v_user_id)
    + (select count(*) from public.profiles where id = v_user_id)
    into v_deleted_records;

  delete from public.profiles where id = v_user_id;

  -- Recreate the clean onboarding state. The profile trigger seeds the eleven
  -- default categories, then we add the default zero-balance wallet.
  insert into public.profiles (id, display_name)
  values (v_user_id, v_display_name);

  insert into public.wallets (
    user_id,
    name,
    wallet_type,
    initial_balance,
    current_balance,
    tone
  )
  values (
    v_user_id,
    'Tunai',
    'cash',
    0,
    0,
    '#0F172A'
  )
  returning id into v_wallet_id;

  return jsonb_build_object(
    'reset', true,
    'deleted_records', v_deleted_records,
    'wallet_id', v_wallet_id,
    'reset_at', now()
  );
end;
$$;

revoke all on function public.reset_current_user_data() from public;
grant execute on function public.reset_current_user_data() to authenticated;
