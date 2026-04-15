alter table public.chat_messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Users can upload own chat attachments" on storage.objects;
drop policy if exists "Users can read own chat attachments" on storage.objects;
drop policy if exists "Users can delete own chat attachments" on storage.objects;
create policy "Users can upload own chat attachments" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users can read own chat attachments" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users can delete own chat attachments" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create or replace function public.normalize_entity_name(p_name text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(lower(trim(coalesce(p_name, ''))), '\s+', ' ', 'g'), '')
$$;
create or replace function public.ensure_default_wallet()
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

  perform 1
  from public.profiles
  where id = v_user_id
  for update;

  select *
    into v_wallet
  from public.wallets
  where user_id = v_user_id
    and coalesce(is_archived, false) = false
  order by
    case when lower(name) = 'tunai' then 0 else 1 end,
    created_at asc
  limit 1;

  if found then
    return jsonb_build_object(
      'wallet_id', v_wallet.id,
      'wallet_name', v_wallet.name,
      'created', false
    );
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
    'Tunai',
    'cash',
    0,
    0,
    '#0F172A'
  )
  returning * into v_wallet;

  return jsonb_build_object(
    'wallet_id', v_wallet.id,
    'wallet_name', v_wallet.name,
    'created', true
  );
end;
$$;
create or replace function public.get_name_conflicts()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet_conflicts jsonb := '[]'::jsonb;
  v_goal_conflicts jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  with wallet_groups as (
    select
      public.normalize_entity_name(name) as normalized_name,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'currentBalance', current_balance,
          'isArchived', coalesce(is_archived, false)
        )
        order by created_at asc
      ) as items,
      count(*) filter (where coalesce(is_archived, false) = false) as active_count
    from public.wallets
    where user_id = v_user_id
      and public.normalize_entity_name(name) is not null
    group by public.normalize_entity_name(name)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'normalizedName', normalized_name,
        'items', items
      )
      order by normalized_name asc
    ),
    '[]'::jsonb
  )
  into v_wallet_conflicts
  from wallet_groups
  where active_count > 1;

  with goal_groups as (
    select
      public.normalize_entity_name(name) as normalized_name,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'status', status,
          'currentAmount', current_amount,
          'targetAmount', target_amount
        )
        order by created_at asc
      ) as items,
      count(*) filter (where coalesce(status, 'active') <> 'cancelled') as active_count
    from public.goals
    where user_id = v_user_id
      and public.normalize_entity_name(name) is not null
    group by public.normalize_entity_name(name)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'normalizedName', normalized_name,
        'items', items
      )
      order by normalized_name asc
    ),
    '[]'::jsonb
  )
  into v_goal_conflicts
  from goal_groups
  where active_count > 1;

  return jsonb_build_object(
    'wallets', v_wallet_conflicts,
    'goals', v_goal_conflicts
  );
end;
$$;
create or replace function public.rename_wallet(
  p_wallet_id uuid,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet public.wallets%rowtype;
  v_normalized_name text := public.normalize_entity_name(p_name);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_normalized_name is null then
    raise exception 'Wallet name is required';
  end if;

  perform 1
  from public.profiles
  where id = v_user_id
  for update;

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
  set name = trim(p_name),
      updated_at = timezone('utc', now())
  where id = p_wallet_id
    and user_id = v_user_id
  returning * into v_wallet;

  return jsonb_build_object(
    'wallet_id', v_wallet.id,
    'wallet_name', v_wallet.name
  );
end;
$$;
create or replace function public.rename_goal(
  p_goal_id uuid,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal public.goals%rowtype;
  v_normalized_name text := public.normalize_entity_name(p_name);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_normalized_name is null then
    raise exception 'Goal name is required';
  end if;

  perform 1
  from public.profiles
  where id = v_user_id
  for update;

  select *
    into v_goal
  from public.goals
  where id = p_goal_id
    and user_id = v_user_id
    and coalesce(status, 'active') <> 'cancelled'
  for update;

  if not found then
    raise exception 'Goal not found';
  end if;

  if exists (
    select 1
    from public.goals
    where user_id = v_user_id
      and id <> p_goal_id
      and coalesce(status, 'active') <> 'cancelled'
      and public.normalize_entity_name(name) = v_normalized_name
  ) then
    raise exception 'Goal name is already in use';
  end if;

  update public.goals
  set name = trim(p_name),
      updated_at = timezone('utc', now())
  where id = p_goal_id
    and user_id = v_user_id
  returning * into v_goal;

  return jsonb_build_object(
    'goal_id', v_goal.id,
    'goal_name', v_goal.name
  );
end;
$$;
create or replace function public.adjust_wallet_balance(
  p_wallet_id uuid,
  p_delta numeric
)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_balance numeric;
  v_new_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_delta is null then
    raise exception 'Delta is required';
  end if;

  select current_balance
    into v_current_balance
  from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false
  for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  v_new_balance := coalesce(v_current_balance, 0) + p_delta;

  if v_new_balance < 0 then
    raise exception 'Insufficient wallet balance';
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
security invoker
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
    raise exception 'Not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if lower(coalesce(p_transaction_type, '')) not in ('income', 'expense') then
    raise exception 'Invalid transaction type';
  end if;

  if p_category_id is not null and not exists (
    select 1
    from public.categories
    where id = p_category_id
      and user_id = v_user_id
  ) then
    raise exception 'Category not found';
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
security invoker
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
    raise exception 'Not authenticated';
  end if;

  if p_from_wallet_id = p_to_wallet_id then
    raise exception 'Source and destination wallet must be different';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select name into v_from_name
  from public.wallets
  where id = p_from_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false;

  if not found then
    raise exception 'Source wallet not found';
  end if;

  select name into v_to_name
  from public.wallets
  where id = p_to_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false;

  if not found then
    raise exception 'Destination wallet not found';
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
security invoker
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
    raise exception 'Not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if p_wallet_id is null then
    raise exception 'Wallet is required';
  end if;

  select *
    into v_goal
  from public.goals
  where id = p_goal_id
    and user_id = v_user_id
    and coalesce(status, 'active') <> 'cancelled'
  for update;

  if not found then
    raise exception 'Goal not found';
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
security invoker
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
    raise exception 'Not authenticated';
  end if;

  if v_normalized_name is null then
    raise exception 'Goal name is required';
  end if;

  if p_target_amount is null or p_target_amount <= 0 then
    raise exception 'Target amount must be greater than zero';
  end if;

  if coalesce(p_initial_amount, 0) < 0 then
    raise exception 'Initial amount must not be negative';
  end if;

  if coalesce(p_initial_amount, 0) > 0 and p_wallet_id is null then
    raise exception 'Wallet is required for an initial contribution';
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
    raise exception 'Goal name is already in use';
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
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet public.wallets%rowtype;
  v_transaction_id uuid := null;
  v_normalized_name text := public.normalize_entity_name(p_name);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_normalized_name is null then
    raise exception 'Wallet name is required';
  end if;

  if coalesce(p_initial_balance, 0) < 0 then
    raise exception 'Initial balance must not be negative';
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
    raise exception 'Wallet name is already in use';
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
do $$
begin
  if not exists (
    select 1
    from (
      select user_id, public.normalize_entity_name(name)
      from public.wallets
      where coalesce(is_archived, false) = false
      group by user_id, public.normalize_entity_name(name)
      having count(*) > 1
    ) duplicates
  ) then
    if not exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and indexname = 'wallets_user_normalized_name_active_idx'
    ) then
      execute '
        create unique index wallets_user_normalized_name_active_idx
        on public.wallets (user_id, public.normalize_entity_name(name))
        where coalesce(is_archived, false) = false
      ';
    end if;
  else
    raise notice 'Skipping wallet unique index because duplicate active wallet names still exist.';
  end if;

  if not exists (
    select 1
    from (
      select user_id, public.normalize_entity_name(name)
      from public.goals
      where coalesce(status, 'active') <> 'cancelled'
      group by user_id, public.normalize_entity_name(name)
      having count(*) > 1
    ) duplicates
  ) then
    if not exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and indexname = 'goals_user_normalized_name_active_idx'
    ) then
      execute '
        create unique index goals_user_normalized_name_active_idx
        on public.goals (user_id, public.normalize_entity_name(name))
        where coalesce(status, ''active'') <> ''cancelled''
      ';
    end if;
  else
    raise notice 'Skipping goal unique index because duplicate active goal names still exist.';
  end if;
end;
$$;
revoke all on function public.normalize_entity_name(text) from public;
revoke all on function public.ensure_default_wallet() from public;
revoke all on function public.get_name_conflicts() from public;
revoke all on function public.rename_wallet(uuid, text) from public;
revoke all on function public.rename_goal(uuid, text) from public;
grant execute on function public.normalize_entity_name(text) to authenticated, service_role;
grant execute on function public.ensure_default_wallet() to authenticated, service_role;
grant execute on function public.get_name_conflicts() to authenticated, service_role;
grant execute on function public.rename_wallet(uuid, text) to authenticated, service_role;
grant execute on function public.rename_goal(uuid, text) to authenticated, service_role;
