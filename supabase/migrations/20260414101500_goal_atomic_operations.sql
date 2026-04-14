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

  return jsonb_build_object(
    'goal_id', p_goal_id,
    'goal_name', v_goal.name,
    'new_goal_amount', v_new_amount,
    'wallet_id', p_wallet_id,
    'wallet_balance', v_wallet_balance
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
    trim(p_name),
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
  end if;

  return jsonb_build_object(
    'goal_id', v_goal_id,
    'goal_name', trim(p_name),
    'target_amount', p_target_amount,
    'initial_amount', coalesce(p_initial_amount, 0),
    'wallet_id', p_wallet_id,
    'wallet_balance', v_wallet_balance
  );
end;
$$;
