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
