-- Make default-category creation idempotent and repair duplicates created by
-- concurrent client startup calls. Existing references are repointed before
-- duplicate category rows are removed.
create temporary table category_deduplication_map on commit drop as
select id as duplicate_id, keep_id
from (
  select
    id,
    first_value(id) over (
      partition by user_id, lower(regexp_replace(trim(name), '\s+', ' ', 'g'))
      order by created_at nulls last, id
    ) as keep_id,
    row_number() over (
      partition by user_id, lower(regexp_replace(trim(name), '\s+', ' ', 'g'))
      order by created_at nulls last, id
    ) as duplicate_rank
  from public.categories
) ranked
where duplicate_rank > 1;

update public.transactions as transaction_row
set category_id = mapping.keep_id
from category_deduplication_map mapping
where transaction_row.category_id = mapping.duplicate_id;

update public.smart_category_rules rule
set category_id = mapping.keep_id
from category_deduplication_map mapping
where rule.category_id = mapping.duplicate_id;

create temporary table merged_category_budgets on commit drop as
select
  budget.user_id,
  coalesce(mapping.keep_id, budget.category_id) as category_id,
  max(budget.monthly_limit) as monthly_limit,
  min(budget.created_at) as created_at,
  max(budget.updated_at) as updated_at
from public.budgets budget
left join category_deduplication_map mapping
  on mapping.duplicate_id = budget.category_id
where mapping.keep_id is not null
   or budget.category_id in (select keep_id from category_deduplication_map)
group by budget.user_id, coalesce(mapping.keep_id, budget.category_id);

delete from public.budgets budget
where budget.category_id in (
  select duplicate_id from category_deduplication_map
  union
  select keep_id from category_deduplication_map
);

insert into public.budgets (user_id, category_id, monthly_limit, created_at, updated_at)
select user_id, category_id, monthly_limit, created_at, updated_at
from merged_category_budgets;

delete from public.categories category
using category_deduplication_map mapping
where category.id = mapping.duplicate_id;

alter table public.categories
  add column if not exists normalized_name text
  generated always as (
    lower(regexp_replace(trim(name), '\s+', ' ', 'g'))
  ) stored;

alter table public.categories
  drop constraint if exists categories_name_not_blank;

alter table public.categories
  add constraint categories_name_not_blank check (normalized_name <> '');

alter table public.categories
  drop constraint if exists categories_user_normalized_name_key;

alter table public.categories
  add constraint categories_user_normalized_name_key unique (user_id, normalized_name);

create or replace function public.ensure_default_categories()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_inserted integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'Profile not found';
  end if;

  insert into public.categories (user_id, name, icon, color, category_type) values
    (v_user_id, 'Makan', 'ShoppingBag', '#F59E0B', 'expense'),
    (v_user_id, 'Kopi', 'Coffee', '#92400E', 'expense'),
    (v_user_id, 'Jajan', 'Pizza', '#F97316', 'expense'),
    (v_user_id, 'Belanja', 'ShoppingCart', '#8B5CF6', 'expense'),
    (v_user_id, 'Transport', 'Car', '#3B82F6', 'expense'),
    (v_user_id, 'Bensin', 'Car', '#EF4444', 'expense'),
    (v_user_id, 'Tagihan', 'Zap', '#F97316', 'expense'),
    (v_user_id, 'Pulsa & Data', 'Smartphone', '#2563EB', 'expense'),
    (v_user_id, 'Hiburan', 'BadgeDollarSign', '#EC4899', 'expense'),
    (v_user_id, 'Kesehatan', 'HeartHandshake', '#10B981', 'expense'),
    (v_user_id, 'Rumah', 'Home', '#64748B', 'expense'),
    (v_user_id, 'Gaji', 'Landmark', '#059669', 'income'),
    (v_user_id, 'Bonus', 'Gift', '#14B8A6', 'income'),
    (v_user_id, 'Freelance', 'BriefcaseBusiness', '#4F46E5', 'income'),
    (v_user_id, 'Investasi', 'CircleDollarSign', '#0F766E', 'income'),
    (v_user_id, 'Lainnya', 'Receipt', '#6B7280', 'both')
  on conflict (user_id, normalized_name) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

create or replace function public.seed_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.categories (user_id, name, icon, color, category_type) values
    (new.id, 'Makan', 'ShoppingBag', '#F59E0B', 'expense'),
    (new.id, 'Kopi', 'Coffee', '#92400E', 'expense'),
    (new.id, 'Jajan', 'Pizza', '#F97316', 'expense'),
    (new.id, 'Belanja', 'ShoppingCart', '#8B5CF6', 'expense'),
    (new.id, 'Transport', 'Car', '#3B82F6', 'expense'),
    (new.id, 'Bensin', 'Car', '#EF4444', 'expense'),
    (new.id, 'Tagihan', 'Zap', '#F97316', 'expense'),
    (new.id, 'Pulsa & Data', 'Smartphone', '#2563EB', 'expense'),
    (new.id, 'Hiburan', 'BadgeDollarSign', '#EC4899', 'expense'),
    (new.id, 'Kesehatan', 'HeartHandshake', '#10B981', 'expense'),
    (new.id, 'Rumah', 'Home', '#64748B', 'expense'),
    (new.id, 'Gaji', 'Landmark', '#059669', 'income'),
    (new.id, 'Bonus', 'Gift', '#14B8A6', 'income'),
    (new.id, 'Freelance', 'BriefcaseBusiness', '#4F46E5', 'income'),
    (new.id, 'Investasi', 'CircleDollarSign', '#0F766E', 'income'),
    (new.id, 'Lainnya', 'Receipt', '#6B7280', 'both')
  on conflict (user_id, normalized_name) do nothing;

  return new;
end;
$$;

revoke all on function public.ensure_default_categories() from public, anon, anonymous;
grant execute on function public.ensure_default_categories() to authenticated, service_role;

revoke all on function public.seed_default_categories() from public, anon, anonymous, authenticated;

-- This pure helper was created after the global function-grant lockdown and
-- inherited PostgreSQL's PUBLIC execute default.
revoke all on function public.infer_transaction_category_name(text, text)
  from public, anon, anonymous;
grant execute on function public.infer_transaction_category_name(text, text)
  to authenticated, service_role;

alter table public.transactions
  drop constraint if exists transactions_amount_check;
alter table public.transactions
  add constraint transactions_amount_check check (amount > 0);

alter table public.budgets
  drop constraint if exists budgets_monthly_limit_check;
alter table public.budgets
  add constraint budgets_monthly_limit_check check (monthly_limit > 0);

notify pgrst, 'reload schema';
