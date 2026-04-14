alter table public.transactions
  add column if not exists analytics_bucket text;

update public.transactions
set source = case
  when nullif(trim(coalesce(source, '')), '') is null then 'chat'
  when lower(trim(source)) = 'app' then 'chat'
  else lower(trim(source))
end;

update public.transactions
set analytics_bucket = case
  when lower(coalesce(source, '')) in ('goal_contribution', 'goal_initial_contribution') then 'savings'
  when lower(coalesce(source, '')) = 'transfer' then 'internal_transfer'
  when lower(coalesce(source, '')) = 'wallet_opening_balance' then 'opening_balance'
  when lower(coalesce(transaction_type, '')) = 'income' then 'income'
  else 'expense'
end
where analytics_bucket is null;

alter table public.transactions
  alter column source set default 'chat';

alter table public.transactions
  alter column source set not null;

alter table public.transactions
  alter column analytics_bucket set default 'expense';

alter table public.transactions
  alter column analytics_bucket set not null;

alter table public.transactions
  drop constraint if exists transactions_analytics_bucket_check;

alter table public.transactions
  add constraint transactions_analytics_bucket_check
  check (
    analytics_bucket in (
      'income',
      'expense',
      'savings',
      'internal_transfer',
      'opening_balance'
    )
  );

create index if not exists idx_transactions_user_bucket_occurred_at
  on public.transactions (user_id, analytics_bucket, occurred_at desc);

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
    when v_source in ('goal_contribution', 'goal_initial_contribution') then 'savings'
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
  v_goal goals%rowtype;
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
      end
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
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
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
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Wallet name is required';
  end if;

  if coalesce(p_initial_balance, 0) < 0 then
    raise exception 'Initial balance must not be negative';
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

create or replace function public.get_analytics_snapshot(
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  with filtered_transactions as (
    select
      t.amount,
      t.transaction_type,
      coalesce(
        t.analytics_bucket,
        case
          when lower(coalesce(t.source, '')) in ('goal_contribution', 'goal_initial_contribution') then 'savings'
          when lower(coalesce(t.source, '')) = 'transfer' then 'internal_transfer'
          when lower(coalesce(t.source, '')) = 'wallet_opening_balance' then 'opening_balance'
          when lower(coalesce(t.transaction_type, '')) = 'income' then 'income'
          else 'expense'
        end
      ) as analytics_bucket,
      coalesce(c.name, 'Lainnya') as category_name
    from public.transactions t
    left join public.categories c
      on c.id = t.category_id
     and c.user_id = v_user_id
    where t.user_id = v_user_id
      and (p_start_at is null or t.occurred_at >= p_start_at)
      and (p_end_at is null or t.occurred_at <= p_end_at)
  ),
  totals as (
    select
      coalesce(sum(case when analytics_bucket = 'income' then amount else 0 end), 0) as total_income,
      coalesce(sum(case when analytics_bucket = 'expense' then amount else 0 end), 0) as total_expense,
      coalesce(sum(case when analytics_bucket = 'savings' then amount else 0 end), 0) as total_savings,
      coalesce(
        sum(
          case
            when analytics_bucket = 'internal_transfer'
             and lower(coalesce(transaction_type, '')) = 'expense' then amount
            else 0
          end
        ),
        0
      ) as transfer_volume
    from filtered_transactions
  ),
  expense_categories as (
    select
      category_name as name,
      sum(amount) as amount
    from filtered_transactions
    where analytics_bucket = 'expense'
    group by category_name
  )
  select jsonb_build_object(
    'totalIncome', totals.total_income,
    'totalExpense', totals.total_expense,
    'totalSavings', totals.total_savings,
    'netCashflow', totals.total_income - totals.total_expense - totals.total_savings,
    'transferVolume', totals.transfer_volume,
    'topExpenseCategories',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'name', name,
              'amount', amount,
              'percentage',
                case
                  when totals.total_expense > 0 then round(((amount / totals.total_expense) * 100)::numeric, 2)
                  else 0
                end
            )
            order by amount desc
          )
          from expense_categories
        ),
        '[]'::jsonb
      )
  )
  into v_result
  from totals;

  return coalesce(
    v_result,
    jsonb_build_object(
      'totalIncome', 0,
      'totalExpense', 0,
      'totalSavings', 0,
      'netCashflow', 0,
      'transferVolume', 0,
      'topExpenseCategories', '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.create_wallet_with_opening_balance(text, numeric, text, text) from public;
revoke all on function public.get_analytics_snapshot(timestamptz, timestamptz) from public;

grant execute on function public.create_wallet_with_opening_balance(text, numeric, text, text) to authenticated, service_role;
grant execute on function public.get_analytics_snapshot(timestamptz, timestamptz) to authenticated, service_role;
