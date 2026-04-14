drop policy if exists "Users can delete own transactions" on public.transactions;

drop policy if exists "Users can manage their own goals" on public.goals;

create policy "Users can view own goals" on public.goals
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own goals" on public.goals
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own goals" on public.goals
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.delete_transaction_and_revert_balance(
  p_transaction_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet_id uuid;
  v_transaction_type text;
  v_amount numeric;
  v_delta numeric;
  v_new_balance numeric;
  v_source text;
  v_analytics_bucket text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select
    wallet_id,
    transaction_type,
    amount,
    lower(coalesce(source, '')),
    coalesce(
      analytics_bucket,
      case
        when lower(coalesce(source, '')) in ('goal_contribution', 'goal_initial_contribution', 'goal_refund') then 'savings'
        when lower(coalesce(source, '')) = 'transfer' then 'internal_transfer'
        when lower(coalesce(source, '')) = 'wallet_opening_balance' then 'opening_balance'
        when lower(coalesce(transaction_type, '')) = 'income' then 'income'
        else 'expense'
      end
    )
  into
    v_wallet_id,
    v_transaction_type,
    v_amount,
    v_source,
    v_analytics_bucket
  from public.transactions
  where id = p_transaction_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Transaction not found';
  end if;

  if v_analytics_bucket not in ('income', 'expense') or v_source not in ('chat', 'manual', 'ocr') then
    raise exception 'This ledger entry cannot be deleted directly';
  end if;

  v_delta := case
    when lower(v_transaction_type) = 'income' then -v_amount
    else v_amount
  end;

  update public.wallets
  set current_balance = coalesce(current_balance, 0) + v_delta,
      updated_at = timezone('utc', now())
  where id = v_wallet_id
    and user_id = v_user_id
  returning current_balance into v_new_balance;

  if not found then
    raise exception 'Wallet not found';
  end if;

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

create or replace function public.delete_goal_and_restore_funds(
  p_goal_id uuid,
  p_wallet_id uuid default null
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
  v_refund_amount numeric := 0;
  v_wallet_balance numeric := null;
  v_transaction_id uuid := null;
  v_created_wallet boolean := false;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
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

  v_refund_amount := greatest(coalesce(v_goal.current_amount, 0), 0);

  if v_refund_amount > 0 then
    if p_wallet_id is not null then
      select *
        into v_wallet
      from public.wallets
      where id = p_wallet_id
        and user_id = v_user_id
        and coalesce(is_archived, false) = false
      for update;
    else
      select *
        into v_wallet
      from public.wallets
      where user_id = v_user_id
        and coalesce(is_archived, false) = false
      order by
        case when lower(name) = 'tunai' then 0 else 1 end,
        created_at asc
      limit 1
      for update;
    end if;

    if not found then
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

      v_created_wallet := true;
    end if;

    update public.wallets
    set current_balance = coalesce(current_balance, 0) + v_refund_amount,
        updated_at = timezone('utc', now())
    where id = v_wallet.id
      and user_id = v_user_id
    returning current_balance into v_wallet_balance;

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
      v_refund_amount,
      'Pengembalian target ' || v_goal.name,
      'goal_refund',
      'savings',
      timezone('utc', now())
    )
    returning id into v_transaction_id;
  end if;

  delete from public.goals
  where id = p_goal_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'goal_id', p_goal_id,
    'goal_name', v_goal.name,
    'refunded_amount', v_refund_amount,
    'wallet_id', v_wallet.id,
    'wallet_name', v_wallet.name,
    'wallet_balance', v_wallet_balance,
    'transaction_id', v_transaction_id,
    'created_wallet', v_created_wallet
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
          when lower(coalesce(t.source, '')) in ('goal_contribution', 'goal_initial_contribution', 'goal_refund') then 'savings'
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
      coalesce(
        sum(
          case
            when analytics_bucket = 'savings' and lower(coalesce(transaction_type, '')) = 'expense' then amount
            when analytics_bucket = 'savings' and lower(coalesce(transaction_type, '')) = 'income' then -amount
            else 0
          end
        ),
        0
      ) as total_savings,
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
  ),
  income_categories as (
    select
      category_name as name,
      sum(amount) as amount
    from filtered_transactions
    where analytics_bucket = 'income'
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
      ),
    'topIncomeCategories',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'name', name,
              'amount', amount,
              'percentage',
                case
                  when totals.total_income > 0 then round(((amount / totals.total_income) * 100)::numeric, 2)
                  else 0
                end
            )
            order by amount desc
          )
          from income_categories
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
      'topExpenseCategories', '[]'::jsonb,
      'topIncomeCategories', '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.delete_transaction_and_revert_balance(uuid) from public;
revoke all on function public.delete_goal_and_restore_funds(uuid, uuid) from public;
revoke all on function public.get_analytics_snapshot(timestamptz, timestamptz) from public;

grant execute on function public.delete_transaction_and_revert_balance(uuid) to authenticated, service_role;
grant execute on function public.delete_goal_and_restore_funds(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_analytics_snapshot(timestamptz, timestamptz) to authenticated, service_role;
