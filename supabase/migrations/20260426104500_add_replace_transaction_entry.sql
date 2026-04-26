create or replace function public.replace_transaction_entry(
  p_transaction_id uuid,
  p_wallet_id uuid,
  p_category_id uuid default null,
  p_transaction_type text default 'expense',
  p_amount numeric default 0,
  p_merchant text default null,
  p_notes text default null,
  p_occurred_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_old_wallet_id uuid;
  v_old_transaction_type text;
  v_old_amount numeric;
  v_old_source text;
  v_old_analytics_bucket text;
  v_new_transaction_type text := lower(coalesce(p_transaction_type, ''));
  v_new_analytics_bucket text;
  v_new_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;

  select
    wallet_id,
    lower(coalesce(transaction_type, '')),
    amount,
    lower(coalesce(source, '')),
    coalesce(
      analytics_bucket,
      case
        when lower(coalesce(transaction_type, '')) = 'income' then 'income'
        else 'expense'
      end
    )
  into
    v_old_wallet_id,
    v_old_transaction_type,
    v_old_amount,
    v_old_source,
    v_old_analytics_bucket
  from public.transactions
  where id = p_transaction_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Transaksi tidak ditemukan.';
  end if;

  if v_old_analytics_bucket not in ('income', 'expense') or v_old_source not in ('chat', 'manual', 'ocr') then
    raise exception 'Transaksi ini tidak bisa dikoreksi langsung.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal transaksi harus lebih besar dari nol.';
  end if;

  if v_new_transaction_type not in ('income', 'expense') then
    raise exception 'Jenis transaksi tidak valid.';
  end if;

  if not exists (
    select 1
    from public.wallets
    where id = p_wallet_id
      and user_id = v_user_id
      and coalesce(is_archived, false) = false
  ) then
    raise exception 'Dompet transaksi tidak ditemukan.';
  end if;

  if p_category_id is not null and not exists (
    select 1
    from public.categories
    where id = p_category_id
      and user_id = v_user_id
  ) then
    raise exception 'Kategori transaksi tidak ditemukan.';
  end if;

  perform public.adjust_wallet_balance(
    v_old_wallet_id,
    case
      when v_old_transaction_type = 'income' then -v_old_amount
      else v_old_amount
    end
  );

  v_new_balance := public.adjust_wallet_balance(
    p_wallet_id,
    case
      when v_new_transaction_type = 'income' then p_amount
      else -p_amount
    end
  );

  v_new_analytics_bucket := case
    when v_new_transaction_type = 'income' then 'income'
    else 'expense'
  end;

  update public.transactions
  set wallet_id = p_wallet_id,
      category_id = p_category_id,
      transaction_type = v_new_transaction_type,
      amount = p_amount,
      merchant = nullif(trim(coalesce(p_merchant, '')), ''),
      notes = nullif(trim(coalesce(p_notes, '')), ''),
      occurred_at = coalesce(p_occurred_at, occurred_at),
      analytics_bucket = v_new_analytics_bucket
  where id = p_transaction_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'transaction_id', p_transaction_id,
    'wallet_id', p_wallet_id,
    'old_wallet_id', v_old_wallet_id,
    'new_balance', v_new_balance,
    'source', v_old_source,
    'analytics_bucket', v_new_analytics_bucket
  );
end;
$$;

revoke all on function public.replace_transaction_entry(uuid, uuid, uuid, text, numeric, text, text, timestamptz) from public;
grant execute on function public.replace_transaction_entry(uuid, uuid, uuid, text, numeric, text, text, timestamptz) to authenticated, service_role;
