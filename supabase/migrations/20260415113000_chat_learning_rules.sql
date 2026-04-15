alter table public.smart_category_rules
  add column if not exists usage_count integer not null default 1;

alter table public.smart_category_rules
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.smart_wallet_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  keyword text not null,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  usage_count integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.smart_wallet_rules enable row level security;

drop policy if exists "Users can view own wallet rules" on public.smart_wallet_rules;

create policy "Users can view own wallet rules" on public.smart_wallet_rules
  for select
  using (auth.uid() = user_id);

create index if not exists idx_smart_wallet_rules_user_keyword
  on public.smart_wallet_rules (user_id, lower(keyword));

create or replace function public.learn_from_chat_input(
  p_raw_text text,
  p_wallet_id uuid default null,
  p_category_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_keyword text;
  v_keywords text[];
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

  v_keywords := array(
    select keyword
    from (
      select distinct lower(trim(token)) as keyword
      from regexp_split_to_table(
        regexp_replace(lower(coalesce(p_raw_text, '')), '[^[:alnum:]\s]', ' ', 'g'),
        '\s+'
      ) as token
    ) tokens
    where keyword is not null
      and length(keyword) between 3 and 32
      and keyword !~ '^\d+$'
      and keyword not in (
        'rp', 'idr', 'k', 'rb', 'ribu', 'jt', 'juta', 'm',
        'beli', 'bayar', 'keluar', 'masuk', 'gaji', 'bonus',
        'tabung', 'transfer', 'dari', 'ke', 'untuk', 'pakai', 'pake',
        'dompet', 'wallet', 'rekening', 'buat', 'bikin', 'tambah',
        'uang', 'saldo', 'target', 'milestone', 'hari', 'ini'
      )
    order by length(keyword) desc, keyword asc
    limit 4
  );

  if coalesce(array_length(v_keywords, 1), 0) = 0 then
    return jsonb_build_object(
      'keywords', '[]'::jsonb,
      'categoryRulesUpdated', 0,
      'walletRulesUpdated', 0
    );
  end if;

  foreach v_keyword in array v_keywords loop
    if p_category_id is not null then
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
    end if;

    if p_wallet_id is not null then
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
    end if;
  end loop;

  return jsonb_build_object(
    'keywords', to_jsonb(v_keywords),
    'categoryRulesUpdated', v_category_updates,
    'walletRulesUpdated', v_wallet_updates
  );
end;
$$;

revoke all on function public.learn_from_chat_input(text, uuid, uuid) from public;
grant execute on function public.learn_from_chat_input(text, uuid, uuid) to authenticated, service_role;
