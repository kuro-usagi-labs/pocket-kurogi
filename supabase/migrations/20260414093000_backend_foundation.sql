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

  update public.wallets
  set current_balance = v_new_balance
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
  p_source text default 'app',
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

  v_delta := case
    when lower(p_transaction_type) = 'income' then p_amount
    else -p_amount
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
    coalesce(nullif(trim(coalesce(p_source, '')), ''), 'app'),
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'transaction_id', v_transaction_id,
    'wallet_id', p_wallet_id,
    'new_balance', v_new_balance
  );
end;
$$;

create or replace function public.delete_transaction_and_revert_balance(
  p_transaction_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet_id uuid;
  v_transaction_type text;
  v_amount numeric;
  v_delta numeric;
  v_new_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select wallet_id, transaction_type, amount
    into v_wallet_id, v_transaction_type, v_amount
  from public.transactions
  where id = p_transaction_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Transaction not found';
  end if;

  v_delta := case
    when lower(v_transaction_type) = 'income' then -v_amount
    else v_amount
  end;

  v_new_balance := public.adjust_wallet_balance(v_wallet_id, v_delta);

  delete from public.transactions
  where id = p_transaction_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'transaction_id', p_transaction_id,
    'wallet_id', v_wallet_id,
    'new_balance', v_new_balance
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
    occurred_at
  )
  values (
    v_user_id,
    p_from_wallet_id,
    'expense',
    p_amount,
    coalesce(nullif(trim(coalesce(p_description, '')), ''), 'Transfer ke ' || v_to_name),
    'transfer',
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
    occurred_at
  )
  values (
    v_user_id,
    p_to_wallet_id,
    'income',
    p_amount,
    coalesce(nullif(trim(coalesce(p_description, '')), ''), 'Transfer dari ' || v_from_name),
    'transfer',
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_income_transaction_id;

  return jsonb_build_object(
    'expense_transaction_id', v_expense_transaction_id,
    'income_transaction_id', v_income_transaction_id,
    'from_wallet_balance', v_from_balance,
    'to_wallet_balance', v_to_balance
  );
end;
$$;
