revoke insert, update, delete on table public.wallets from anon, authenticated;
revoke insert, update, delete on table public.transactions from anon, authenticated;
revoke insert, update, delete on table public.goals from anon, authenticated;

create or replace function public.adjust_wallet_balance(
  p_wallet_id uuid,
  p_delta numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_balance numeric;
  v_new_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;

  if p_delta is null then
    raise exception 'Perubahan saldo tidak valid.';
  end if;

  select current_balance
    into v_current_balance
  from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false
  for update;

  if not found then
    raise exception 'Dompet tidak ditemukan atau sudah diarsipkan.';
  end if;

  v_new_balance := coalesce(v_current_balance, 0) + p_delta;

  if v_new_balance < 0 then
    raise exception 'Saldo dompet tidak cukup untuk menyelesaikan aksi ini.';
  end if;

  update public.wallets
  set current_balance = v_new_balance,
      updated_at = timezone('utc', now())
  where id = p_wallet_id
    and user_id = v_user_id;

  return v_new_balance;
end;
$$;

create or replace function public.record_transaction(
  p_wallet_id uuid,
  p_category_id uuid default null,
  p_transaction_type text default 'expense',
  p_amount numeric default 0,
  p_merchant text default null,
  p_notes text default null,
  p_source text default 'chat',
  p_occurred_at timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_delta numeric;
  v_transaction_id uuid;
  v_new_balance numeric;
  v_source text := lower(coalesce(nullif(trim(coalesce(p_source, '')), ''), 'chat'));
  v_analytics_bucket text;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal transaksi harus lebih besar dari nol.';
  end if;

  if lower(coalesce(p_transaction_type, '')) not in ('income', 'expense') then
    raise exception 'Jenis transaksi tidak valid.';
  end if;

  if p_category_id is not null and not exists (
    select 1
    from public.categories
    where id = p_category_id
      and user_id = v_user_id
  ) then
    raise exception 'Kategori transaksi tidak ditemukan.';
  end if;

  v_delta := case
    when lower(p_transaction_type) = 'income' then p_amount
    else -p_amount
  end;

  v_analytics_bucket := case
    when v_source in ('goal_contribution', 'goal_initial_contribution', 'goal_refund', 'goal_withdrawal') then 'savings'
    when v_source = 'transfer' then 'internal_transfer'
    when v_source = 'wallet_opening_balance' then 'opening_balance'
    when lower(p_transaction_type) = 'income' then 'income'
    else 'expense'
  end;

  v_new_balance := public.adjust_wallet_balance(p_wallet_id, v_delta);

  insert into public.transactions (
    user_id,
    wallet_id,
    category_id,
    transaction_type,
    amount,
    merchant,
    notes,
    source,
    analytics_bucket,
    occurred_at
  )
  values (
    v_user_id,
    p_wallet_id,
    p_category_id,
    lower(p_transaction_type),
    p_amount,
    nullif(trim(coalesce(p_merchant, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    v_source,
    v_analytics_bucket,
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'transaction_id', v_transaction_id,
    'wallet_id', p_wallet_id,
    'new_balance', v_new_balance,
    'analytics_bucket', v_analytics_bucket,
    'source', v_source
  );
end;
$$;

create or replace function public.transfer_between_wallets(
  p_from_wallet_id uuid,
  p_to_wallet_id uuid,
  p_amount numeric,
  p_description text default null,
  p_occurred_at timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_from_balance numeric;
  v_to_balance numeric;
  v_from_name text;
  v_to_name text;
  v_expense_transaction_id uuid;
  v_income_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;

  if p_from_wallet_id = p_to_wallet_id then
    raise exception 'Dompet asal dan tujuan harus berbeda.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal transfer harus lebih besar dari nol.';
  end if;

  select name into v_from_name
  from public.wallets
  where id = p_from_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false;

  if not found then
    raise exception 'Dompet asal tidak ditemukan.';
  end if;

  select name into v_to_name
  from public.wallets
  where id = p_to_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false;

  if not found then
    raise exception 'Dompet tujuan tidak ditemukan.';
  end if;

  v_from_balance := public.adjust_wallet_balance(p_from_wallet_id, -p_amount);
  v_to_balance := public.adjust_wallet_balance(p_to_wallet_id, p_amount);

  insert into public.transactions (
    user_id,
    wallet_id,
    transaction_type,
    amount,
    merchant,
    source,
    analytics_bucket,
    occurred_at
  )
  values (
    v_user_id,
    p_from_wallet_id,
    'expense',
    p_amount,
    coalesce(nullif(trim(coalesce(p_description, '')), ''), 'Transfer ke ' || v_to_name),
    'transfer',
    'internal_transfer',
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_expense_transaction_id;

  insert into public.transactions (
    user_id,
    wallet_id,
    transaction_type,
    amount,
    merchant,
    source,
    analytics_bucket,
    occurred_at
  )
  values (
    v_user_id,
    p_to_wallet_id,
    'income',
    p_amount,
    coalesce(nullif(trim(coalesce(p_description, '')), ''), 'Transfer dari ' || v_from_name),
    'transfer',
    'internal_transfer',
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_income_transaction_id;

  return jsonb_build_object(
    'expense_transaction_id', v_expense_transaction_id,
    'income_transaction_id', v_income_transaction_id,
    'from_wallet_balance', v_from_balance,
    'to_wallet_balance', v_to_balance,
    'transfer_volume', p_amount
  );
end;
$$;

create or replace function public.contribute_to_goal(
  p_goal_id uuid,
  p_amount numeric,
  p_wallet_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal public.goals%rowtype;
  v_new_amount numeric;
  v_wallet_balance numeric;
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal setoran target harus lebih besar dari nol.';
  end if;

  if p_wallet_id is null then
    raise exception 'Pilih dompet sumber untuk setoran target ini.';
  end if;

  select *
    into v_goal
  from public.goals
  where id = p_goal_id
    and user_id = v_user_id
    and coalesce(status, 'active') <> 'cancelled'
  for update;

  if not found then
    raise exception 'Target tidak ditemukan.';
  end if;

  v_wallet_balance := public.adjust_wallet_balance(p_wallet_id, -p_amount);
  v_new_amount := coalesce(v_goal.current_amount, 0) + p_amount;

  update public.goals
  set current_amount = v_new_amount,
      status = case
        when v_goal.target_amount is not null and v_new_amount >= v_goal.target_amount then 'completed'
        else 'active'
      end,
      updated_at = timezone('utc', now())
  where id = p_goal_id
    and user_id = v_user_id;

  insert into public.transactions (
    user_id,
    wallet_id,
    transaction_type,
    amount,
    merchant,
    source,
    analytics_bucket,
    occurred_at
  )
  values (
    v_user_id,
    p_wallet_id,
    'expense',
    p_amount,
    'Setoran target ' || v_goal.name,
    'goal_contribution',
    'savings',
    timezone('utc', now())
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'goal_id', p_goal_id,
    'goal_name', v_goal.name,
    'new_goal_amount', v_new_amount,
    'wallet_id', p_wallet_id,
    'wallet_balance', v_wallet_balance,
    'transaction_id', v_transaction_id
  );
end;
$$;

create or replace function public.create_goal_with_contribution(
  p_name text,
  p_target_amount numeric,
  p_deadline date default null,
  p_icon text default '🎯',
  p_initial_amount numeric default 0,
  p_wallet_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal_id uuid;
  v_wallet_balance numeric := null;
  v_transaction_id uuid := null;
  v_goal_name text := trim(p_name);
  v_normalized_name text := public.normalize_entity_name(p_name);
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;

  if v_normalized_name is null then
    raise exception 'Nama target wajib diisi.';
  end if;

  if p_target_amount is null or p_target_amount <= 0 then
    raise exception 'Nominal target harus lebih besar dari nol.';
  end if;

  if coalesce(p_initial_amount, 0) < 0 then
    raise exception 'Setoran awal tidak boleh negatif.';
  end if;

  if coalesce(p_initial_amount, 0) > 0 and p_wallet_id is null then
    raise exception 'Pilih dompet sumber untuk setoran awal target ini.';
  end if;

  perform 1
  from public.profiles
  where id = v_user_id
  for update;

  if exists (
    select 1
    from public.goals
    where user_id = v_user_id
      and coalesce(status, 'active') <> 'cancelled'
      and public.normalize_entity_name(name) = v_normalized_name
  ) then
    raise exception 'Nama target ini sudah dipakai. Gunakan nama yang lebih spesifik.';
  end if;

  insert into public.goals (
    user_id,
    name,
    target_amount,
    current_amount,
    deadline,
    icon,
    status
  )
  values (
    v_user_id,
    v_goal_name,
    p_target_amount,
    coalesce(p_initial_amount, 0),
    p_deadline,
    coalesce(nullif(trim(coalesce(p_icon, '')), ''), '🎯'),
    case
      when coalesce(p_initial_amount, 0) >= p_target_amount then 'completed'
      else 'active'
    end
  )
  returning id into v_goal_id;

  if coalesce(p_initial_amount, 0) > 0 then
    v_wallet_balance := public.adjust_wallet_balance(p_wallet_id, -p_initial_amount);

    insert into public.transactions (
      user_id,
      wallet_id,
      transaction_type,
      amount,
      merchant,
      source,
      analytics_bucket,
      occurred_at
    )
    values (
      v_user_id,
      p_wallet_id,
      'expense',
      p_initial_amount,
      'Setoran awal target ' || v_goal_name,
      'goal_initial_contribution',
      'savings',
      timezone('utc', now())
    )
    returning id into v_transaction_id;
  end if;

  return jsonb_build_object(
    'goal_id', v_goal_id,
    'goal_name', v_goal_name,
    'target_amount', p_target_amount,
    'initial_amount', coalesce(p_initial_amount, 0),
    'wallet_id', p_wallet_id,
    'wallet_balance', v_wallet_balance,
    'transaction_id', v_transaction_id
  );
end;
$$;

create or replace function public.create_wallet_with_opening_balance(
  p_name text,
  p_initial_balance numeric default 0,
  p_wallet_type text default 'cash',
  p_tone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet public.wallets%rowtype;
  v_transaction_id uuid := null;
  v_normalized_name text := public.normalize_entity_name(p_name);
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;

  if v_normalized_name is null then
    raise exception 'Nama dompet wajib diisi.';
  end if;

  if coalesce(p_initial_balance, 0) < 0 then
    raise exception 'Saldo awal tidak boleh negatif.';
  end if;

  perform 1
  from public.profiles
  where id = v_user_id
  for update;

  if exists (
    select 1
    from public.wallets
    where user_id = v_user_id
      and coalesce(is_archived, false) = false
      and public.normalize_entity_name(name) = v_normalized_name
  ) then
    raise exception 'Nama dompet ini sudah dipakai. Gunakan nama lain agar chat tidak bingung.';
  end if;

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
    trim(p_name),
    coalesce(nullif(trim(coalesce(p_wallet_type, '')), ''), 'cash'),
    coalesce(p_initial_balance, 0),
    coalesce(p_initial_balance, 0),
    coalesce(p_tone, '#0F172A')
  )
  returning * into v_wallet;

  if coalesce(p_initial_balance, 0) > 0 then
    insert into public.transactions (
      user_id,
      wallet_id,
      transaction_type,
      amount,
      merchant,
      source,
      analytics_bucket,
      occurred_at
    )
    values (
      v_user_id,
      v_wallet.id,
      'income',
      p_initial_balance,
      'Saldo awal ' || v_wallet.name,
      'wallet_opening_balance',
      'opening_balance',
      timezone('utc', now())
    )
    returning id into v_transaction_id;
  end if;

  return jsonb_build_object(
    'wallet_id', v_wallet.id,
    'wallet_name', v_wallet.name,
    'wallet_type', v_wallet.wallet_type,
    'initial_balance', v_wallet.initial_balance,
    'current_balance', v_wallet.current_balance,
    'tone', v_wallet.tone,
    'transaction_id', v_transaction_id
  );
end;
$$;

create or replace function public.withdraw_from_goal(
  p_goal_id uuid,
  p_amount numeric,
  p_wallet_id uuid,
  p_description text default null,
  p_occurred_at timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal public.goals%rowtype;
  v_wallet public.wallets%rowtype;
  v_new_goal_amount numeric;
  v_wallet_balance numeric;
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal pencairan target harus lebih besar dari nol.';
  end if;

  if p_wallet_id is null then
    raise exception 'Pilih dompet tujuan untuk pencairan target ini.';
  end if;

  select *
    into v_goal
  from public.goals
  where id = p_goal_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Target tidak ditemukan.';
  end if;

  if coalesce(v_goal.current_amount, 0) < p_amount then
    raise exception 'Saldo target tidak cukup untuk dicairkan.';
  end if;

  select *
    into v_wallet
  from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false
  for update;

  if not found then
    raise exception 'Dompet tujuan tidak ditemukan.';
  end if;

  v_new_goal_amount := coalesce(v_goal.current_amount, 0) - p_amount;
  v_wallet_balance := public.adjust_wallet_balance(p_wallet_id, p_amount);

  update public.goals
  set current_amount = v_new_goal_amount,
      status = case
        when v_goal.target_amount is not null and v_new_goal_amount >= v_goal.target_amount then 'completed'
        else 'active'
      end,
      updated_at = timezone('utc', now())
  where id = p_goal_id
    and user_id = v_user_id;

  insert into public.transactions (
    user_id,
    wallet_id,
    transaction_type,
    amount,
    merchant,
    source,
    analytics_bucket,
    occurred_at
  )
  values (
    v_user_id,
    p_wallet_id,
    'income',
    p_amount,
    coalesce(nullif(trim(coalesce(p_description, '')), ''), 'Pencairan target ' || v_goal.name),
    'goal_withdrawal',
    'savings',
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'goal_id', p_goal_id,
    'goal_name', v_goal.name,
    'new_goal_amount', v_new_goal_amount,
    'wallet_id', p_wallet_id,
    'wallet_name', v_wallet.name,
    'wallet_balance', v_wallet_balance,
    'transaction_id', v_transaction_id
  );
end;
$$;

revoke all on function public.adjust_wallet_balance(uuid, numeric) from public;
revoke all on function public.record_transaction(uuid, uuid, text, numeric, text, text, text, timestamptz) from public;
revoke all on function public.transfer_between_wallets(uuid, uuid, numeric, text, timestamptz) from public;
revoke all on function public.contribute_to_goal(uuid, numeric, uuid) from public;
revoke all on function public.create_goal_with_contribution(text, numeric, date, text, numeric, uuid) from public;
revoke all on function public.create_wallet_with_opening_balance(text, numeric, text, text) from public;
revoke all on function public.withdraw_from_goal(uuid, numeric, uuid, text, timestamptz) from public;

grant execute on function public.adjust_wallet_balance(uuid, numeric) to authenticated, service_role;
grant execute on function public.record_transaction(uuid, uuid, text, numeric, text, text, text, timestamptz) to authenticated, service_role;
grant execute on function public.transfer_between_wallets(uuid, uuid, numeric, text, timestamptz) to authenticated, service_role;
grant execute on function public.contribute_to_goal(uuid, numeric, uuid) to authenticated, service_role;
grant execute on function public.create_goal_with_contribution(text, numeric, date, text, numeric, uuid) to authenticated, service_role;
grant execute on function public.create_wallet_with_opening_balance(text, numeric, text, text) to authenticated, service_role;
grant execute on function public.withdraw_from_goal(uuid, numeric, uuid, text, timestamptz) to authenticated, service_role;
