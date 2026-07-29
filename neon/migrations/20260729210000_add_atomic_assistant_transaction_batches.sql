create table if not exists public.transaction_batch_requests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  payload_hash text not null,
  payload jsonb not null,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

alter table public.transaction_batch_requests enable row level security;

revoke all on table public.transaction_batch_requests from public, anonymous, authenticated;

comment on table public.transaction_batch_requests is
  'Private idempotency ledger for atomic assistant transaction batches. Accessible only through the owner function.';

create or replace function public.record_transactions_batch(
  p_request_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_payload_hash text;
  v_existing public.transaction_batch_requests%rowtype;
  v_item jsonb;
  v_item_count integer;
  v_client_item_id text;
  v_wallet_id uuid;
  v_category_id uuid;
  v_transaction_type text;
  v_amount numeric;
  v_merchant text;
  v_notes text;
  v_occurred_at timestamptz;
  v_record_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_total_amount numeric := 0;
  v_expense_total numeric := 0;
  v_income_total numeric := 0;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;

  if p_request_id is null then
    raise exception 'Request ID batch wajib diisi.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Payload batch harus berupa array.';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 20 then
    raise exception 'Batch harus berisi 1 sampai 20 transaksi.';
  end if;

  if (
    select count(*) <> count(distinct nullif(btrim(item ->> 'client_item_id'), ''))
    from jsonb_array_elements(p_items) as entries(item)
  ) then
    raise exception 'client_item_id dalam satu batch harus unik.';
  end if;

  v_payload_hash := md5(p_items::text);

  insert into public.transaction_batch_requests (
    user_id,
    request_id,
    payload_hash,
    payload
  )
  values (
    v_user_id,
    p_request_id,
    v_payload_hash,
    p_items
  )
  on conflict (user_id, request_id) do nothing;

  select *
    into v_existing
  from public.transaction_batch_requests
  where user_id = v_user_id
    and request_id = p_request_id
  for update;

  if v_existing.payload_hash <> v_payload_hash or v_existing.payload <> p_items then
    raise exception 'Request ID ini sudah dipakai untuk payload transaksi yang berbeda.';
  end if;

  if v_existing.result is not null then
    return jsonb_set(v_existing.result, '{replayed}', 'true'::jsonb, true);
  end if;

  -- Validate the complete payload and ownership before changing any balance.
  for v_item in
    select item
    from jsonb_array_elements(p_items) as entries(item)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Setiap item batch harus berupa object.';
    end if;

    v_client_item_id := nullif(trim(coalesce(v_item ->> 'client_item_id', '')), '');
    if v_client_item_id is null or length(v_client_item_id) > 100 then
      raise exception 'client_item_id item batch tidak valid.';
    end if;

    if coalesce(v_item ->> 'wallet_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'wallet_id item batch tidak valid.';
    end if;
    v_wallet_id := (v_item ->> 'wallet_id')::uuid;

    if not exists (
      select 1
      from public.wallets
      where id = v_wallet_id
        and user_id = v_user_id
        and coalesce(is_archived, false) = false
    ) then
      raise exception 'Dompet transaksi tidak ditemukan.';
    end if;

    v_transaction_type := lower(trim(coalesce(v_item ->> 'transaction_type', '')));
    if v_transaction_type not in ('income', 'expense') then
      raise exception 'Jenis transaksi item batch tidak valid.';
    end if;

    if nullif(trim(coalesce(v_item ->> 'category_id', '')), '') is null then
      v_category_id := null;
    else
      if (v_item ->> 'category_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'category_id item batch tidak valid.';
      end if;
      v_category_id := (v_item ->> 'category_id')::uuid;

      if not exists (
        select 1
        from public.categories
        where id = v_category_id
          and user_id = v_user_id
          and category_type in (v_transaction_type, 'both')
      ) then
        raise exception 'Kategori transaksi tidak ditemukan atau tidak sesuai jenis transaksi.';
      end if;
    end if;

    if coalesce(v_item ->> 'amount', '') !~ '^\d+(?:\.\d+)?$' then
      raise exception 'Nominal item batch tidak valid.';
    end if;
    v_amount := (v_item ->> 'amount')::numeric;
    if v_amount <= 0 or v_amount > 9999999999999.99 or v_amount <> round(v_amount, 2) then
      raise exception 'Nominal item batch harus positif, maksimal 13 digit, dan paling banyak dua desimal.';
    end if;
  end loop;

  -- Lock every wallet in deterministic order to avoid A->B / B->A deadlocks.
  perform id
  from public.wallets
  where user_id = v_user_id
    and id in (
      select distinct (item ->> 'wallet_id')::uuid
      from jsonb_array_elements(p_items) as entries(item)
    )
  order by id
  for update;

  -- record_transaction is atomic itself; any exception here rolls back the entire outer batch.
  for v_item in
    select item
    from jsonb_array_elements(p_items) with ordinality as entries(item, item_order)
    order by item_order
  loop
    v_client_item_id := trim(v_item ->> 'client_item_id');
    v_wallet_id := (v_item ->> 'wallet_id')::uuid;
    v_category_id := nullif(trim(coalesce(v_item ->> 'category_id', '')), '')::uuid;
    v_transaction_type := lower(trim(v_item ->> 'transaction_type'));
    v_amount := (v_item ->> 'amount')::numeric;
    v_merchant := nullif(trim(coalesce(v_item ->> 'merchant', '')), '');
    v_notes := nullif(trim(coalesce(v_item ->> 'notes', '')), '');
    v_occurred_at := case
      when nullif(trim(coalesce(v_item ->> 'occurred_at', '')), '') is null then now()
      else (v_item ->> 'occurred_at')::timestamptz
    end;

    v_record_result := public.record_transaction(
      v_wallet_id,
      v_category_id,
      v_transaction_type,
      v_amount,
      v_merchant,
      v_notes,
      'chat',
      v_occurred_at
    );

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'client_item_id', v_client_item_id,
      'transaction_id', v_record_result ->> 'transaction_id',
      'wallet_id', v_record_result ->> 'wallet_id',
      'new_balance', (v_record_result ->> 'new_balance')::numeric
    ));
    v_total_amount := v_total_amount + v_amount;
    if v_transaction_type = 'income' then
      v_income_total := v_income_total + v_amount;
    else
      v_expense_total := v_expense_total + v_amount;
    end if;
  end loop;

  v_result := jsonb_build_object(
    'request_id', p_request_id,
    'replayed', false,
    'item_count', v_item_count,
    'total_amount', v_total_amount,
    'expense_total', v_expense_total,
    'income_total', v_income_total,
    'net_delta', v_income_total - v_expense_total,
    'transactions', v_results
  );

  update public.transaction_batch_requests
  set result = v_result
  where user_id = v_user_id
    and request_id = p_request_id;

  return v_result;
end;
$$;

revoke all on function public.record_transactions_batch(uuid, jsonb) from public, anonymous, authenticated;
grant execute on function public.record_transactions_batch(uuid, jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
