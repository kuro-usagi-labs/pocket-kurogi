create or replace function public.withdraw_from_goal(
  p_goal_id uuid,
  p_amount numeric,
  p_wallet_id uuid,
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
  v_goal public.goals%rowtype;
  v_wallet public.wallets%rowtype;
  v_new_goal_amount numeric;
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

  if coalesce(v_goal.current_amount, 0) < p_amount then
    raise exception 'Goal balance is insufficient';
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

revoke all on function public.withdraw_from_goal(uuid, numeric, uuid, text, timestamptz) from public;

grant execute on function public.withdraw_from_goal(uuid, numeric, uuid, text, timestamptz) to authenticated, service_role;
