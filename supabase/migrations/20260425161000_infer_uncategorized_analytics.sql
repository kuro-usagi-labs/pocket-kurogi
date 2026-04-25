create or replace function public.infer_transaction_category_name(
  p_text text,
  p_transaction_type text default 'expense'
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_text text := lower(coalesce(p_text, ''));
  v_type text := lower(coalesce(p_transaction_type, 'expense'));
begin
  if v_type = 'income' then
    if v_text ~ '(gaji|salary|payroll|upah|penghasilan|pendapatan)' then
      return 'Gaji';
    elsif v_text ~ '(bonus|thr|reward|cashback|refund|hadiah|insentif)' then
      return 'Bonus';
    elsif v_text ~ '(freelance|project|proyek|client|komisi|commission|fee|jasa|side job)' then
      return 'Freelance';
    elsif v_text ~ '(investasi|investment|dividen|return|bunga|interest|yield|capital gain)' then
      return 'Investasi';
    end if;

    return 'Lainnya';
  end if;

  if v_text ~ '(makan|makanan|food|meal|lunch|dinner|sarapan|breakfast|restoran|resto|restaurant|warteg|bakso|mie|nasi|ayam|gofood|grabfood)' then
    return 'Makan';
  elsif v_text ~ '(kopi|coffee|ngopi|cafe|kafe|latte|espresso|americano|cappuccino|starbucks|fore|tomoro|kenangan)' then
    return 'Kopi';
  elsif v_text ~ '(jajan|snack|camilan|cemilan|ngemil|roti|biskuit|wafer|coklat|permen|es krim|ice cream|golda|teh botol|ultra milk|pocari|yakult)' then
    return 'Jajan';
  elsif v_text ~ '(belanja|shopping|groceries|grocery|supermarket|minimarket|alfamart|indomaret|mart|store|toko|market|household|keperluan)' then
    return 'Belanja';
  elsif v_text ~ '(transport|transportasi|commute|gojek|grab|gocar|goride|ojek|taxi|bus|kereta|parkir|tol|travel|perjalanan)' then
    return 'Transport';
  elsif v_text ~ '(bensin|bbm|fuel|pertalite|pertamax|solar|spbu|shell|vpower)' then
    return 'Bensin';
  elsif v_text ~ '(tagihan|bills|bill|listrik|pln|token|air|pdam|internet|wifi|indihome|subscription|langganan|bpjs|ipl|maintenance fee)' then
    return 'Tagihan';
  elsif v_text ~ '(pulsa|kuota|data|paket data|paket internet|topup pulsa|top up pulsa|isi pulsa|sim card)' then
    return 'Pulsa & Data';
  elsif v_text ~ '(hiburan|entertainment|movie|film|bioskop|netflix|spotify|steam|game|gaming|playstation|xbox|nonton)' then
    return 'Hiburan';
  elsif v_text ~ '(kesehatan|health|obat|dokter|klinik|rumah sakit|medical|vitamin|apotik|apotek)' then
    return 'Kesehatan';
  elsif v_text ~ '(rumah|home|kos|kontrakan|sewa|rent|laundry|perabot|furnitur|furniture)' then
    return 'Rumah';
  end if;

  return 'Lainnya';
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
      coalesce(
        c.name,
        public.infer_transaction_category_name(concat_ws(' ', t.merchant, t.notes), t.transaction_type),
        'Lainnya'
      ) as category_name
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

  return coalesce(v_result, jsonb_build_object(
    'totalIncome', 0,
    'totalExpense', 0,
    'totalSavings', 0,
    'netCashflow', 0,
    'transferVolume', 0,
    'topExpenseCategories', '[]'::jsonb,
    'topIncomeCategories', '[]'::jsonb
  ));
end;
$$;
