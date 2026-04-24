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

update public.smart_category_rules
set keyword = lower(trim(keyword)),
    usage_count = greatest(coalesce(usage_count, 1), 1),
    updated_at = coalesce(updated_at, timezone('utc', now()))
where keyword is not null;

update public.smart_wallet_rules
set keyword = lower(trim(keyword)),
    usage_count = greatest(coalesce(usage_count, 1), 1),
    updated_at = coalesce(updated_at, timezone('utc', now()))
where keyword is not null;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, keyword
      order by
        greatest(coalesce(usage_count, 1), 1) desc,
        coalesce(updated_at, created_at, timezone('utc', now())) desc,
        coalesce(created_at, updated_at, timezone('utc', now())) asc,
        id asc
    ) as rn,
    sum(greatest(coalesce(usage_count, 1), 1)) over (
      partition by user_id, keyword
    ) as merged_usage_count,
    min(created_at) over (
      partition by user_id, keyword
    ) as merged_created_at,
    max(coalesce(updated_at, created_at, timezone('utc', now()))) over (
      partition by user_id, keyword
    ) as merged_updated_at
  from public.smart_category_rules
)
update public.smart_category_rules target
set usage_count = ranked.merged_usage_count,
    created_at = coalesce(ranked.merged_created_at, target.created_at, timezone('utc', now())),
    updated_at = ranked.merged_updated_at
from ranked
where target.id = ranked.id
  and ranked.rn = 1;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, keyword
      order by
        greatest(coalesce(usage_count, 1), 1) desc,
        coalesce(updated_at, created_at, timezone('utc', now())) desc,
        coalesce(created_at, updated_at, timezone('utc', now())) asc,
        id asc
    ) as rn
  from public.smart_category_rules
)
delete from public.smart_category_rules target
using ranked
where target.id = ranked.id
  and ranked.rn > 1;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, keyword
      order by
        greatest(coalesce(usage_count, 1), 1) desc,
        coalesce(updated_at, created_at, timezone('utc', now())) desc,
        coalesce(created_at, updated_at, timezone('utc', now())) asc,
        id asc
    ) as rn,
    sum(greatest(coalesce(usage_count, 1), 1)) over (
      partition by user_id, keyword
    ) as merged_usage_count,
    min(created_at) over (
      partition by user_id, keyword
    ) as merged_created_at,
    max(coalesce(updated_at, created_at, timezone('utc', now()))) over (
      partition by user_id, keyword
    ) as merged_updated_at
  from public.smart_wallet_rules
)
update public.smart_wallet_rules target
set usage_count = ranked.merged_usage_count,
    created_at = coalesce(ranked.merged_created_at, target.created_at, timezone('utc', now())),
    updated_at = ranked.merged_updated_at
from ranked
where target.id = ranked.id
  and ranked.rn = 1;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, keyword
      order by
        greatest(coalesce(usage_count, 1), 1) desc,
        coalesce(updated_at, created_at, timezone('utc', now())) desc,
        coalesce(created_at, updated_at, timezone('utc', now())) asc,
        id asc
    ) as rn
  from public.smart_wallet_rules
)
delete from public.smart_wallet_rules target
using ranked
where target.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists smart_category_rules_user_keyword_key
  on public.smart_category_rules (user_id, keyword);

create unique index if not exists smart_wallet_rules_user_keyword_key
  on public.smart_wallet_rules (user_id, keyword);

create or replace function public.learn_from_chat_input(
  p_raw_text text,
  p_wallet_id uuid default null,
  p_category_id uuid default null,
  p_category_keywords text[] default null,
  p_wallet_keywords text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_keyword text;
  v_category_keywords text[];
  v_wallet_keywords text[];
  v_category_updates integer := 0;
  v_wallet_updates integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_wallet_id is not null and not exists (
    select 1
    from public.wallets
    where id = p_wallet_id
      and user_id = v_user_id
      and coalesce(is_archived, false) = false
  ) then
    raise exception 'Wallet not found';
  end if;

  if p_category_id is not null and not exists (
    select 1
    from public.categories
    where id = p_category_id
      and user_id = v_user_id
  ) then
    raise exception 'Category not found';
  end if;

  v_category_keywords := array(
    select keyword
    from (
      select distinct keyword
      from (
        select lower(trim(token)) as keyword
        from regexp_split_to_table(
          regexp_replace(lower(coalesce(p_raw_text, '')), '[^[:alnum:]\s]', ' ', 'g'),
          '\s+'
        ) as token

        union all

        select regexp_replace(lower(trim(hint)), '\s+', ' ', 'g') as keyword
        from unnest(coalesce(p_category_keywords, '{}'::text[])) as hint
      ) raw_keywords
      where keyword is not null
        and length(keyword) between 2 and 48
        and keyword !~ '^\d+$'
        and keyword not in (
          'rp', 'idr', 'k', 'rb', 'ribu', 'jt', 'juta', 'm',
          'beli', 'bayar', 'keluar', 'masuk', 'gaji', 'bonus',
          'tabung', 'transfer', 'dari', 'ke', 'untuk', 'pakai', 'pake',
          'dompet', 'wallet', 'rekening', 'buat', 'bikin', 'tambah',
          'uang', 'saldo', 'target', 'milestone', 'hari', 'ini',
          'expense', 'income', 'pengeluaran', 'pemasukan', 'transaksi',
          'catat', 'transaction', 'category', 'kategori', 'lainnya', 'other'
        )
    ) filtered_keywords
    order by length(keyword) desc, keyword asc
    limit 8
  );

  v_wallet_keywords := array(
    select keyword
    from (
      select distinct keyword
      from (
        select lower(trim(token)) as keyword
        from regexp_split_to_table(
          regexp_replace(lower(coalesce(p_raw_text, '')), '[^[:alnum:]\s]', ' ', 'g'),
          '\s+'
        ) as token

        union all

        select regexp_replace(lower(trim(hint)), '\s+', ' ', 'g') as keyword
        from unnest(coalesce(p_wallet_keywords, '{}'::text[])) as hint
      ) raw_keywords
      where keyword is not null
        and length(keyword) between 2 and 48
        and keyword !~ '^\d+$'
        and keyword not in (
          'rp', 'idr', 'k', 'rb', 'ribu', 'jt', 'juta', 'm',
          'beli', 'bayar', 'keluar', 'masuk', 'gaji', 'bonus',
          'tabung', 'transfer', 'dari', 'ke', 'untuk', 'pakai', 'pake',
          'dompet', 'wallet', 'rekening', 'buat', 'bikin', 'tambah',
          'uang', 'saldo', 'target', 'milestone', 'hari', 'ini',
          'expense', 'income', 'pengeluaran', 'pemasukan', 'transaksi',
          'catat', 'transaction', 'category', 'kategori'
        )
    ) filtered_keywords
    order by length(keyword) desc, keyword asc
    limit 8
  );

  if coalesce(array_length(v_category_keywords, 1), 0) = 0
    and coalesce(array_length(v_wallet_keywords, 1), 0) = 0 then
    return jsonb_build_object(
      'categoryKeywords', '[]'::jsonb,
      'walletKeywords', '[]'::jsonb,
      'categoryRulesUpdated', 0,
      'walletRulesUpdated', 0
    );
  end if;

  if p_category_id is not null then
    foreach v_keyword in array coalesce(v_category_keywords, '{}'::text[]) loop
      insert into public.smart_category_rules (
        user_id,
        keyword,
        category_id,
        usage_count,
        updated_at
      )
      values (
        v_user_id,
        v_keyword,
        p_category_id,
        1,
        timezone('utc', now())
      )
      on conflict (user_id, keyword) do update
      set category_id = excluded.category_id,
          usage_count = public.smart_category_rules.usage_count + 1,
          updated_at = excluded.updated_at;

      v_category_updates := v_category_updates + 1;
    end loop;
  end if;

  if p_wallet_id is not null then
    foreach v_keyword in array coalesce(v_wallet_keywords, '{}'::text[]) loop
      insert into public.smart_wallet_rules (
        user_id,
        keyword,
        wallet_id,
        usage_count,
        updated_at
      )
      values (
        v_user_id,
        v_keyword,
        p_wallet_id,
        1,
        timezone('utc', now())
      )
      on conflict (user_id, keyword) do update
      set wallet_id = excluded.wallet_id,
          usage_count = public.smart_wallet_rules.usage_count + 1,
          updated_at = excluded.updated_at;

      v_wallet_updates := v_wallet_updates + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'categoryKeywords', to_jsonb(coalesce(v_category_keywords, '{}'::text[])),
    'walletKeywords', to_jsonb(coalesce(v_wallet_keywords, '{}'::text[])),
    'categoryRulesUpdated', v_category_updates,
    'walletRulesUpdated', v_wallet_updates
  );
end;
$$;

revoke all on function public.delete_transaction_and_revert_balance(uuid) from public;
revoke all on function public.learn_from_chat_input(text, uuid, uuid, text[], text[]) from public;

grant execute on function public.delete_transaction_and_revert_balance(uuid) to authenticated, service_role;
grant execute on function public.learn_from_chat_input(text, uuid, uuid, text[], text[]) to authenticated, service_role;
