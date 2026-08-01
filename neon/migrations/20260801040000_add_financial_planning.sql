create table if not exists public.financial_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  schedule_type text not null,
  amount numeric(18, 2) not null,
  cadence text not null,
  next_due_date date not null,
  goal_id uuid references public.goals(id) on delete cascade,
  wallet_id uuid references public.wallets(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  reminder_enabled boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_schedules_title_check
    check (char_length(trim(title)) between 1 and 120),
  constraint financial_schedules_type_check
    check (schedule_type in ('bill', 'income', 'goal_contribution')),
  constraint financial_schedules_amount_check
    check (amount > 0 and amount <= 9999999999999.99),
  constraint financial_schedules_cadence_check
    check (cadence in ('once', 'weekly', 'monthly')),
  constraint financial_schedules_goal_check
    check (schedule_type <> 'goal_contribution' or goal_id is not null)
);

create table if not exists public.financial_reminder_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  reminder_type text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, reminder_type),
  constraint financial_reminder_preferences_type_check
    check (reminder_type in ('bill', 'income', 'goal_contribution'))
);

create table if not exists public.income_allocation_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  monthly_income numeric(18, 2) not null,
  needs_percent numeric(5, 2) not null,
  savings_percent numeric(5, 2) not null,
  debt_percent numeric(5, 2) not null,
  free_percent numeric(5, 2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint income_allocation_income_check
    check (monthly_income > 0 and monthly_income <= 9999999999999.99),
  constraint income_allocation_percent_range_check
    check (
      needs_percent between 0 and 100 and
      savings_percent between 0 and 100 and
      debt_percent between 0 and 100 and
      free_percent between 0 and 100
    ),
  constraint income_allocation_total_check
    check (needs_percent + savings_percent + debt_percent + free_percent = 100),
  unique (user_id)
);

create index if not exists idx_financial_schedules_user_due
  on public.financial_schedules (user_id, is_active, next_due_date);

alter table public.financial_schedules enable row level security;
alter table public.financial_reminder_preferences enable row level security;
alter table public.income_allocation_plans enable row level security;

drop policy if exists "Users can view own financial schedules"
  on public.financial_schedules;
create policy "Users can view own financial schedules"
  on public.financial_schedules for select to authenticated
  using (public.current_user_id() = user_id);

drop policy if exists "Users can view own reminder preferences"
  on public.financial_reminder_preferences;
create policy "Users can view own reminder preferences"
  on public.financial_reminder_preferences for select to authenticated
  using (public.current_user_id() = user_id);

drop policy if exists "Users can view own income allocation"
  on public.income_allocation_plans;
create policy "Users can view own income allocation"
  on public.income_allocation_plans for select to authenticated
  using (public.current_user_id() = user_id);

revoke all on table public.financial_schedules
  from public, anonymous, authenticated, service_role;
revoke all on table public.financial_reminder_preferences
  from public, anonymous, authenticated, service_role;
revoke all on table public.income_allocation_plans
  from public, anonymous, authenticated, service_role;

grant select on table public.financial_schedules to authenticated;
grant select on table public.financial_reminder_preferences to authenticated;
grant select on table public.income_allocation_plans to authenticated;

create or replace function public.save_financial_schedule(
  p_schedule_id uuid,
  p_title text,
  p_schedule_type text,
  p_amount numeric,
  p_cadence text,
  p_next_due_date date,
  p_goal_id uuid default null,
  p_wallet_id uuid default null,
  p_category_id uuid default null,
  p_reminder_enabled boolean default true,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_type text := lower(trim(coalesce(p_schedule_type, '')));
  v_cadence text := lower(trim(coalesce(p_cadence, '')));
  v_row public.financial_schedules%rowtype;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 120 then
    raise exception 'Judul jadwal tidak valid.';
  end if;
  if v_type not in ('bill', 'income', 'goal_contribution') then
    raise exception 'Jenis jadwal tidak valid.';
  end if;
  if v_cadence not in ('once', 'weekly', 'monthly') then
    raise exception 'Frekuensi jadwal tidak valid.';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 9999999999999.99 then
    raise exception 'Nominal jadwal tidak valid.';
  end if;
  if p_next_due_date is null then raise exception 'Tanggal jadwal wajib diisi.'; end if;
  if v_type = 'goal_contribution' and p_goal_id is null then
    raise exception 'Target wajib dipilih untuk jadwal setoran.';
  end if;
  if p_goal_id is not null and not exists (
    select 1 from public.goals where id = p_goal_id and user_id = v_user_id
  ) then raise exception 'Target tidak ditemukan.'; end if;
  if p_wallet_id is not null and not exists (
    select 1 from public.wallets where id = p_wallet_id and user_id = v_user_id
  ) then raise exception 'Dompet tidak ditemukan.'; end if;
  if p_category_id is not null and not exists (
    select 1 from public.categories where id = p_category_id and user_id = v_user_id
  ) then raise exception 'Kategori tidak ditemukan.'; end if;

  if p_schedule_id is null then
    insert into public.financial_schedules (
      user_id, title, schedule_type, amount, cadence, next_due_date,
      goal_id, wallet_id, category_id, reminder_enabled, is_active
    ) values (
      v_user_id, trim(p_title), v_type, p_amount, v_cadence, p_next_due_date,
      p_goal_id, p_wallet_id, p_category_id, coalesce(p_reminder_enabled, true),
      coalesce(p_is_active, true)
    ) returning * into v_row;
  else
    update public.financial_schedules set
      title = trim(p_title), schedule_type = v_type, amount = p_amount,
      cadence = v_cadence, next_due_date = p_next_due_date,
      goal_id = p_goal_id, wallet_id = p_wallet_id, category_id = p_category_id,
      reminder_enabled = coalesce(p_reminder_enabled, true),
      is_active = coalesce(p_is_active, true), updated_at = now()
    where id = p_schedule_id and user_id = v_user_id
    returning * into v_row;
    if not found then raise exception 'Jadwal tidak ditemukan.'; end if;
  end if;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.delete_financial_schedule(p_schedule_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_row public.financial_schedules%rowtype;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  delete from public.financial_schedules
  where id = p_schedule_id and user_id = v_user_id
  returning * into v_row;
  if not found then raise exception 'Jadwal tidak ditemukan.'; end if;
  return jsonb_build_object('deleted', true, 'id', v_row.id);
end;
$$;

create or replace function public.set_financial_reminder_preference(
  p_reminder_type text,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_type text := lower(trim(coalesce(p_reminder_type, '')));
  v_row public.financial_reminder_preferences%rowtype;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if v_type not in ('bill', 'income', 'goal_contribution') then
    raise exception 'Jenis pengingat tidak valid.';
  end if;
  if p_enabled is null then raise exception 'Status pengingat wajib diisi.'; end if;

  insert into public.financial_reminder_preferences (
    user_id, reminder_type, enabled, updated_at
  ) values (v_user_id, v_type, p_enabled, now())
  on conflict (user_id, reminder_type) do update
  set enabled = excluded.enabled, updated_at = now()
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.save_income_allocation_plan(
  p_monthly_income numeric,
  p_needs_percent numeric,
  p_savings_percent numeric,
  p_debt_percent numeric,
  p_free_percent numeric
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_total numeric;
  v_row public.income_allocation_plans%rowtype;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_monthly_income is null or p_monthly_income <= 0 or p_monthly_income > 9999999999999.99 then
    raise exception 'Nominal gaji tidak valid.';
  end if;
  if p_needs_percent is null or p_savings_percent is null or
     p_debt_percent is null or p_free_percent is null then
    raise exception 'Seluruh persentase alokasi wajib diisi.';
  end if;
  if p_needs_percent not between 0 and 100 or
     p_savings_percent not between 0 and 100 or
     p_debt_percent not between 0 and 100 or
     p_free_percent not between 0 and 100 then
    raise exception 'Persentase alokasi harus di antara 0 dan 100.';
  end if;
  v_total := p_needs_percent + p_savings_percent + p_debt_percent + p_free_percent;
  if v_total <> 100 then raise exception 'Total alokasi harus tepat 100 persen.'; end if;

  insert into public.income_allocation_plans (
    user_id, monthly_income, needs_percent, savings_percent,
    debt_percent, free_percent, updated_at
  ) values (
    v_user_id, p_monthly_income, p_needs_percent, p_savings_percent,
    p_debt_percent, p_free_percent, now()
  ) on conflict (user_id) do update set
    monthly_income = excluded.monthly_income,
    needs_percent = excluded.needs_percent,
    savings_percent = excluded.savings_percent,
    debt_percent = excluded.debt_percent,
    free_percent = excluded.free_percent,
    updated_at = now()
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.save_financial_schedule(uuid, text, text, numeric, text, date, uuid, uuid, uuid, boolean, boolean)
  from public, anonymous, authenticated, service_role;
revoke all on function public.delete_financial_schedule(uuid)
  from public, anonymous, authenticated, service_role;
revoke all on function public.set_financial_reminder_preference(text, boolean)
  from public, anonymous, authenticated, service_role;
revoke all on function public.save_income_allocation_plan(numeric, numeric, numeric, numeric, numeric)
  from public, anonymous, authenticated, service_role;

grant execute on function public.save_financial_schedule(uuid, text, text, numeric, text, date, uuid, uuid, uuid, boolean, boolean)
  to authenticated, service_role;
grant execute on function public.delete_financial_schedule(uuid)
  to authenticated, service_role;
grant execute on function public.set_financial_reminder_preference(text, boolean)
  to authenticated, service_role;
grant execute on function public.save_income_allocation_plan(numeric, numeric, numeric, numeric, numeric)
  to authenticated, service_role;
