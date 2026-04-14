create index if not exists idx_wallets_user_archived_created_at
  on public.wallets (user_id, is_archived, created_at);

create index if not exists idx_categories_user_name
  on public.categories (user_id, lower(name));

create index if not exists idx_transactions_user_occurred_at
  on public.transactions (user_id, occurred_at desc);

create index if not exists idx_transactions_user_wallet
  on public.transactions (user_id, wallet_id);

create index if not exists idx_goals_user_created_at
  on public.goals (user_id, created_at);

create index if not exists idx_chat_messages_user_created_at
  on public.chat_messages (user_id, created_at);

create index if not exists idx_smart_category_rules_user_keyword
  on public.smart_category_rules (user_id, lower(keyword));

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
