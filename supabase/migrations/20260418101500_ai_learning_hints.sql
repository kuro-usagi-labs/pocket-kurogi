create index if not exists idx_smart_category_rules_user_keyword
  on public.smart_category_rules (user_id, lower(keyword));

drop function if exists public.learn_from_chat_input(text, uuid, uuid);

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
      update public.smart_category_rules
      set category_id = p_category_id,
          usage_count = coalesce(usage_count, 0) + 1,
          updated_at = timezone('utc', now())
      where user_id = v_user_id
        and lower(keyword) = v_keyword;

      if found then
        v_category_updates := v_category_updates + 1;
      else
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
        );

        v_category_updates := v_category_updates + 1;
      end if;
    end loop;
  end if;

  if p_wallet_id is not null then
    foreach v_keyword in array coalesce(v_wallet_keywords, '{}'::text[]) loop
      update public.smart_wallet_rules
      set wallet_id = p_wallet_id,
          usage_count = coalesce(usage_count, 0) + 1,
          updated_at = timezone('utc', now())
      where user_id = v_user_id
        and lower(keyword) = v_keyword;

      if found then
        v_wallet_updates := v_wallet_updates + 1;
      else
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
        );

        v_wallet_updates := v_wallet_updates + 1;
      end if;
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

revoke all on function public.learn_from_chat_input(text, uuid, uuid, text[], text[]) from public;
grant execute on function public.learn_from_chat_input(text, uuid, uuid, text[], text[]) to authenticated, service_role;
