-- Pocket Kurogi Neon schema baseline

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$$;

create or replace function public.current_user_id()
returns uuid
language plpgsql
stable
as $$
declare
  direct_sub text;
  claims jsonb;
begin
  direct_sub := nullif(current_setting('request.jwt.claim.sub', true), '');
  if direct_sub is not null then
    return direct_sub::uuid;
  end if;

  begin
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    claims := null;
  end;

  return nullif(claims ->> 'sub', '')::uuid;
end;
$$;

grant execute on function public.current_user_id() to anonymous, authenticated, anon, service_role;

-- Migration: 20260413164017_create_pocket_kurogi_schema.sql
-- ============================================
-- POCKET KUROGI DATABASE SCHEMA
-- ============================================

-- Profiles linked to Neon Auth
CREATE TABLE profiles (
  id UUID PRIMARY KEY references neon_auth."user"(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Wallets
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  wallet_type TEXT DEFAULT 'cash' CHECK (wallet_type IN ('cash', 'bank', 'ewallet', 'investment', 'other')),
  initial_balance NUMERIC(15,2) DEFAULT 0,
  current_balance NUMERIC(15,2) DEFAULT 0,
  tone TEXT DEFAULT '#0F172A',
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT DEFAULT '#0F172A',
  category_type TEXT DEFAULT 'expense' CHECK (category_type IN ('expense', 'income', 'both')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense', 'transfer')),
  amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  merchant TEXT,
  notes TEXT,
  source TEXT DEFAULT 'app',
  occurred_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Smart Category Rules (keyword → category mapping)
CREATE TABLE smart_category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_category_rules ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only access their own profile
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (public.current_user_id() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (public.current_user_id() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (public.current_user_id() = id);

-- Wallets: users can only access their own wallets
CREATE POLICY "Users can view own wallets" ON wallets FOR SELECT USING (public.current_user_id() = user_id);
CREATE POLICY "Users can insert own wallets" ON wallets FOR INSERT WITH CHECK (public.current_user_id() = user_id);
CREATE POLICY "Users can update own wallets" ON wallets FOR UPDATE USING (public.current_user_id() = user_id);
CREATE POLICY "Users can delete own wallets" ON wallets FOR DELETE USING (public.current_user_id() = user_id);

-- Categories: users can only access their own categories
CREATE POLICY "Users can view own categories" ON categories FOR SELECT USING (public.current_user_id() = user_id);
CREATE POLICY "Users can insert own categories" ON categories FOR INSERT WITH CHECK (public.current_user_id() = user_id);
CREATE POLICY "Users can update own categories" ON categories FOR UPDATE USING (public.current_user_id() = user_id);
CREATE POLICY "Users can delete own categories" ON categories FOR DELETE USING (public.current_user_id() = user_id);

-- Transactions: users can only access their own transactions
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (public.current_user_id() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions FOR INSERT WITH CHECK (public.current_user_id() = user_id);
CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE USING (public.current_user_id() = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions FOR DELETE USING (public.current_user_id() = user_id);

-- Smart Category Rules: users can only access their own rules
CREATE POLICY "Users can view own rules" ON smart_category_rules FOR SELECT USING (public.current_user_id() = user_id);
CREATE POLICY "Users can insert own rules" ON smart_category_rules FOR INSERT WITH CHECK (public.current_user_id() = user_id);

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



-- ============================================
-- SEED DEFAULT CATEGORIES ON NEW USER
-- ============================================
CREATE OR REPLACE FUNCTION seed_default_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO categories (user_id, name, icon, color, category_type) VALUES
    (NEW.id, 'Makan', 'ShoppingBag', '#F59E0B', 'expense'),
    (NEW.id, 'Kopi', 'Coffee', '#92400E', 'expense'),
    (NEW.id, 'Transport', 'Car', '#3B82F6', 'expense'),
    (NEW.id, 'Bensin', 'Fuel', '#EF4444', 'expense'),
    (NEW.id, 'Belanja', 'ShoppingCart', '#8B5CF6', 'expense'),
    (NEW.id, 'Listrik', 'Zap', '#F97316', 'expense'),
    (NEW.id, 'Hiburan', 'Gamepad2', '#EC4899', 'expense'),
    (NEW.id, 'Kesehatan', 'Heart', '#10B981', 'expense'),
    (NEW.id, 'Gaji', 'Landmark', '#059669', 'income'),
    (NEW.id, 'Bonus', 'Gift', '#14B8A6', 'income'),
    (NEW.id, 'Lainnya', 'Receipt', '#6B7280', 'both');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_seed_categories
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION seed_default_categories();
;

-- Migration: 20260413193123_create_goals_and_budgets_tables.sql
-- Create Goals Table
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL references neon_auth."user"(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount NUMERIC NOT NULL CHECK (target_amount > 0),
    current_amount NUMERIC DEFAULT 0,
    deadline DATE,
    icon TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create Budgets Table
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL references neon_auth."user"(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    monthly_limit NUMERIC NOT NULL CHECK (monthly_limit >= 0),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, category_id)
);

-- Enable RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- Goals Policies
CREATE POLICY "Users can manage their own goals" ON public.goals
    FOR ALL USING (public.current_user_id() = user_id);

-- Budgets Policies
CREATE POLICY "Users can manage their own budgets" ON public.budgets
    FOR ALL USING (public.current_user_id() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
;

-- Migration: 20260414002450_create_chat_messages.sql
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL references neon_auth."user"(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'bot')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own messages" ON public.chat_messages
  FOR SELECT USING (public.current_user_id() = user_id);

CREATE POLICY "Users can insert their own messages" ON public.chat_messages
  FOR INSERT WITH CHECK (public.current_user_id() = user_id);

CREATE POLICY "Users can delete their own messages" ON public.chat_messages
  FOR DELETE USING (public.current_user_id() = user_id);
;

-- Migration: 20260414093000_backend_foundation.sql
create or replace function public.adjust_wallet_balance(
  p_wallet_id uuid,
  p_delta numeric
)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_current_balance numeric;
  v_new_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_delta is null then
    raise exception 'Delta is required';
  end if;

  select current_balance
    into v_current_balance
  from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false
  for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  v_new_balance := coalesce(v_current_balance, 0) + p_delta;

  update public.wallets
  set current_balance = v_new_balance
  where id = p_wallet_id
    and user_id = v_user_id;

  return v_new_balance;
end;
$$;

create or replace function public.record_transaction(
  p_wallet_id uuid,
  p_category_id uuid default null,
  p_transaction_type text default 'expense',
  p_amount numeric default 0,
  p_merchant text default null,
  p_notes text default null,
  p_source text default 'app',
  p_occurred_at timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_delta numeric;
  v_transaction_id uuid;
  v_new_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if lower(coalesce(p_transaction_type, '')) not in ('income', 'expense') then
    raise exception 'Invalid transaction type';
  end if;

  v_delta := case
    when lower(p_transaction_type) = 'income' then p_amount
    else -p_amount
  end;

  v_new_balance := public.adjust_wallet_balance(p_wallet_id, v_delta);

  insert into public.transactions (
    user_id,
    wallet_id,
    category_id,
    transaction_type,
    amount,
    merchant,
    notes,
    source,
    occurred_at
  )
  values (
    v_user_id,
    p_wallet_id,
    p_category_id,
    lower(p_transaction_type),
    p_amount,
    nullif(trim(coalesce(p_merchant, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    coalesce(nullif(trim(coalesce(p_source, '')), ''), 'app'),
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'transaction_id', v_transaction_id,
    'wallet_id', p_wallet_id,
    'new_balance', v_new_balance
  );
end;
$$;

create or replace function public.delete_transaction_and_revert_balance(
  p_transaction_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_wallet_id uuid;
  v_transaction_type text;
  v_amount numeric;
  v_delta numeric;
  v_new_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select wallet_id, transaction_type, amount
    into v_wallet_id, v_transaction_type, v_amount
  from public.transactions
  where id = p_transaction_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Transaction not found';
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

create or replace function public.transfer_between_wallets(
  p_from_wallet_id uuid,
  p_to_wallet_id uuid,
  p_amount numeric,
  p_description text default null,
  p_occurred_at timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_from_balance numeric;
  v_to_balance numeric;
  v_from_name text;
  v_to_name text;
  v_expense_transaction_id uuid;
  v_income_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_from_wallet_id = p_to_wallet_id then
    raise exception 'Source and destination wallet must be different';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select name into v_from_name
  from public.wallets
  where id = p_from_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false;

  if not found then
    raise exception 'Source wallet not found';
  end if;

  select name into v_to_name
  from public.wallets
  where id = p_to_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false;

  if not found then
    raise exception 'Destination wallet not found';
  end if;

  v_from_balance := public.adjust_wallet_balance(p_from_wallet_id, -p_amount);
  v_to_balance := public.adjust_wallet_balance(p_to_wallet_id, p_amount);

  insert into public.transactions (
    user_id,
    wallet_id,
    transaction_type,
    amount,
    merchant,
    source,
    occurred_at
  )
  values (
    v_user_id,
    p_from_wallet_id,
    'expense',
    p_amount,
    coalesce(nullif(trim(coalesce(p_description, '')), ''), 'Transfer ke ' || v_to_name),
    'transfer',
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_expense_transaction_id;

  insert into public.transactions (
    user_id,
    wallet_id,
    transaction_type,
    amount,
    merchant,
    source,
    occurred_at
  )
  values (
    v_user_id,
    p_to_wallet_id,
    'income',
    p_amount,
    coalesce(nullif(trim(coalesce(p_description, '')), ''), 'Transfer dari ' || v_from_name),
    'transfer',
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_income_transaction_id;

  return jsonb_build_object(
    'expense_transaction_id', v_expense_transaction_id,
    'income_transaction_id', v_income_transaction_id,
    'from_wallet_balance', v_from_balance,
    'to_wallet_balance', v_to_balance
  );
end;
$$;

-- Migration: 20260414101500_goal_atomic_operations.sql
create or replace function public.contribute_to_goal(
  p_goal_id uuid,
  p_amount numeric,
  p_wallet_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_goal goals%rowtype;
  v_new_amount numeric;
  v_wallet_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if p_wallet_id is null then
    raise exception 'Wallet is required';
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

  v_wallet_balance := public.adjust_wallet_balance(p_wallet_id, -p_amount);
  v_new_amount := coalesce(v_goal.current_amount, 0) + p_amount;

  update public.goals
  set current_amount = v_new_amount,
      status = case
        when v_goal.target_amount is not null and v_new_amount >= v_goal.target_amount then 'completed'
        else 'active'
      end
  where id = p_goal_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'goal_id', p_goal_id,
    'goal_name', v_goal.name,
    'new_goal_amount', v_new_amount,
    'wallet_id', p_wallet_id,
    'wallet_balance', v_wallet_balance
  );
end;
$$;

create or replace function public.create_goal_with_contribution(
  p_name text,
  p_target_amount numeric,
  p_deadline date default null,
  p_icon text default '🎯',
  p_initial_amount numeric default 0,
  p_wallet_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_goal_id uuid;
  v_wallet_balance numeric := null;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Goal name is required';
  end if;

  if p_target_amount is null or p_target_amount <= 0 then
    raise exception 'Target amount must be greater than zero';
  end if;

  if coalesce(p_initial_amount, 0) < 0 then
    raise exception 'Initial amount must not be negative';
  end if;

  if coalesce(p_initial_amount, 0) > 0 and p_wallet_id is null then
    raise exception 'Wallet is required for an initial contribution';
  end if;

  insert into public.goals (
    user_id,
    name,
    target_amount,
    current_amount,
    deadline,
    icon,
    status
  )
  values (
    v_user_id,
    trim(p_name),
    p_target_amount,
    coalesce(p_initial_amount, 0),
    p_deadline,
    coalesce(nullif(trim(coalesce(p_icon, '')), ''), '🎯'),
    case
      when coalesce(p_initial_amount, 0) >= p_target_amount then 'completed'
      else 'active'
    end
  )
  returning id into v_goal_id;

  if coalesce(p_initial_amount, 0) > 0 then
    v_wallet_balance := public.adjust_wallet_balance(p_wallet_id, -p_initial_amount);
  end if;

  return jsonb_build_object(
    'goal_id', v_goal_id,
    'goal_name', trim(p_name),
    'target_amount', p_target_amount,
    'initial_amount', coalesce(p_initial_amount, 0),
    'wallet_id', p_wallet_id,
    'wallet_balance', v_wallet_balance
  );
end;
$$;

-- Migration: 20260414113000_backend_audit_hardening.sql
create index if not exists idx_wallets_user_archived_created_at
  on public.wallets (user_id, is_archived, created_at);

create index if not exists idx_categories_user_name
  on public.categories (user_id, lower(name));

create index if not exists idx_transactions_user_occurred_at
  on public.transactions (user_id, occurred_at desc);

create index if not exists idx_transactions_user_wallet
  on public.transactions (user_id, wallet_id);

create index if not exists idx_goals_user_created_at
  on public.goals (user_id, created_at);

create index if not exists idx_chat_messages_user_created_at
  on public.chat_messages (user_id, created_at);

create index if not exists idx_smart_category_rules_user_keyword
  on public.smart_category_rules (user_id, lower(keyword));

create or replace function public.record_transaction(
  p_wallet_id uuid,
  p_category_id uuid default null,
  p_transaction_type text default 'expense',
  p_amount numeric default 0,
  p_merchant text default null,
  p_notes text default null,
  p_source text default 'app',
  p_occurred_at timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_delta numeric;
  v_transaction_id uuid;
  v_new_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if lower(coalesce(p_transaction_type, '')) not in ('income', 'expense') then
    raise exception 'Invalid transaction type';
  end if;

  if p_category_id is not null and not exists (
    select 1
    from public.categories
    where id = p_category_id
      and user_id = v_user_id
  ) then
    raise exception 'Category not found';
  end if;

  v_delta := case
    when lower(p_transaction_type) = 'income' then p_amount
    else -p_amount
  end;

  v_new_balance := public.adjust_wallet_balance(p_wallet_id, v_delta);

  insert into public.transactions (
    user_id,
    wallet_id,
    category_id,
    transaction_type,
    amount,
    merchant,
    notes,
    source,
    occurred_at
  )
  values (
    v_user_id,
    p_wallet_id,
    p_category_id,
    lower(p_transaction_type),
    p_amount,
    nullif(trim(coalesce(p_merchant, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    coalesce(nullif(trim(coalesce(p_source, '')), ''), 'app'),
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'transaction_id', v_transaction_id,
    'wallet_id', p_wallet_id,
    'new_balance', v_new_balance
  );
end;
$$;

-- Migration: 20260414121500_rls_rpc_hardening.sql
alter policy "Users can insert own transactions" on public.transactions
  with check (
    public.current_user_id() = user_id
    and exists (
      select 1
      from public.wallets
      where wallets.id = wallet_id
        and wallets.user_id = public.current_user_id()
        and coalesce(wallets.is_archived, false) = false
    )
    and (
      category_id is null
      or exists (
        select 1
        from public.categories
        where categories.id = category_id
          and categories.user_id = public.current_user_id()
      )
    )
  );

alter policy "Users can update own transactions" on public.transactions
  using (public.current_user_id() = user_id)
  with check (
    public.current_user_id() = user_id
    and exists (
      select 1
      from public.wallets
      where wallets.id = wallet_id
        and wallets.user_id = public.current_user_id()
        and coalesce(wallets.is_archived, false) = false
    )
    and (
      category_id is null
      or exists (
        select 1
        from public.categories
        where categories.id = category_id
          and categories.user_id = public.current_user_id()
      )
    )
  );

alter policy "Users can manage their own budgets" on public.budgets
  using (public.current_user_id() = user_id)
  with check (
    public.current_user_id() = user_id
    and exists (
      select 1
      from public.categories
      where categories.id = category_id
        and categories.user_id = public.current_user_id()
    )
  );

alter policy "Users can insert own rules" on public.smart_category_rules
  with check (
    public.current_user_id() = user_id
    and exists (
      select 1
      from public.categories
      where categories.id = category_id
        and categories.user_id = public.current_user_id()
    )
  );

create policy "Users can update own rules" on public.smart_category_rules
  for update
  using (public.current_user_id() = user_id)
  with check (
    public.current_user_id() = user_id
    and exists (
      select 1
      from public.categories
      where categories.id = category_id
        and categories.user_id = public.current_user_id()
    )
  );

create policy "Users can delete own rules" on public.smart_category_rules
  for delete
  using (public.current_user_id() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  );

  return new;
end;
$$;

create or replace function public.seed_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, name, icon, color, category_type) values
    (new.id, 'Makan', 'ShoppingBag', '#F59E0B', 'expense'),
    (new.id, 'Kopi', 'Coffee', '#92400E', 'expense'),
    (new.id, 'Transport', 'Car', '#3B82F6', 'expense'),
    (new.id, 'Bensin', 'Fuel', '#EF4444', 'expense'),
    (new.id, 'Belanja', 'ShoppingCart', '#8B5CF6', 'expense'),
    (new.id, 'Listrik', 'Zap', '#F97316', 'expense'),
    (new.id, 'Hiburan', 'Gamepad2', '#EC4899', 'expense'),
    (new.id, 'Kesehatan', 'Heart', '#10B981', 'expense'),
    (new.id, 'Gaji', 'Landmark', '#059669', 'income'),
    (new.id, 'Bonus', 'Gift', '#14B8A6', 'income'),
    (new.id, 'Lainnya', 'Receipt', '#6B7280', 'both');

  return new;
end;
$$;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.adjust_wallet_balance(uuid, numeric) from public;
revoke all on function public.record_transaction(uuid, uuid, text, numeric, text, text, text, timestamptz) from public;
revoke all on function public.delete_transaction_and_revert_balance(uuid) from public;
revoke all on function public.transfer_between_wallets(uuid, uuid, numeric, text, timestamptz) from public;
revoke all on function public.contribute_to_goal(uuid, numeric, uuid) from public;
revoke all on function public.create_goal_with_contribution(text, numeric, date, text, numeric, uuid) from public;

grant execute on function public.adjust_wallet_balance(uuid, numeric) to authenticated, service_role;
grant execute on function public.record_transaction(uuid, uuid, text, numeric, text, text, text, timestamptz) to authenticated, service_role;
grant execute on function public.delete_transaction_and_revert_balance(uuid) to authenticated, service_role;
grant execute on function public.transfer_between_wallets(uuid, uuid, numeric, text, timestamptz) to authenticated, service_role;
grant execute on function public.contribute_to_goal(uuid, numeric, uuid) to authenticated, service_role;
grant execute on function public.create_goal_with_contribution(text, numeric, date, text, numeric, uuid) to authenticated, service_role;

-- Migration: 20260414143000_analytics_cashflow_foundation.sql
alter table public.transactions
  add column if not exists analytics_bucket text;

update public.transactions
set source = case
  when nullif(trim(coalesce(source, '')), '') is null then 'chat'
  when lower(trim(source)) = 'app' then 'chat'
  else lower(trim(source))
end;

update public.transactions
set analytics_bucket = case
  when lower(coalesce(source, '')) in ('goal_contribution', 'goal_initial_contribution') then 'savings'
  when lower(coalesce(source, '')) = 'transfer' then 'internal_transfer'
  when lower(coalesce(source, '')) = 'wallet_opening_balance' then 'opening_balance'
  when lower(coalesce(transaction_type, '')) = 'income' then 'income'
  else 'expense'
end
where analytics_bucket is null;

alter table public.transactions
  alter column source set default 'chat';

alter table public.transactions
  alter column source set not null;

alter table public.transactions
  alter column analytics_bucket set default 'expense';

alter table public.transactions
  alter column analytics_bucket set not null;

alter table public.transactions
  drop constraint if exists transactions_analytics_bucket_check;

alter table public.transactions
  add constraint transactions_analytics_bucket_check
  check (
    analytics_bucket in (
      'income',
      'expense',
      'savings',
      'internal_transfer',
      'opening_balance'
    )
  );

create index if not exists idx_transactions_user_bucket_occurred_at
  on public.transactions (user_id, analytics_bucket, occurred_at desc);

create or replace function public.record_transaction(
  p_wallet_id uuid,
  p_category_id uuid default null,
  p_transaction_type text default 'expense',
  p_amount numeric default 0,
  p_merchant text default null,
  p_notes text default null,
  p_source text default 'chat',
  p_occurred_at timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_delta numeric;
  v_transaction_id uuid;
  v_new_balance numeric;
  v_source text := lower(coalesce(nullif(trim(coalesce(p_source, '')), ''), 'chat'));
  v_analytics_bucket text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if lower(coalesce(p_transaction_type, '')) not in ('income', 'expense') then
    raise exception 'Invalid transaction type';
  end if;

  if p_category_id is not null and not exists (
    select 1
    from public.categories
    where id = p_category_id
      and user_id = v_user_id
  ) then
    raise exception 'Category not found';
  end if;

  v_delta := case
    when lower(p_transaction_type) = 'income' then p_amount
    else -p_amount
  end;

  v_analytics_bucket := case
    when v_source in ('goal_contribution', 'goal_initial_contribution') then 'savings'
    when v_source = 'transfer' then 'internal_transfer'
    when v_source = 'wallet_opening_balance' then 'opening_balance'
    when lower(p_transaction_type) = 'income' then 'income'
    else 'expense'
  end;

  v_new_balance := public.adjust_wallet_balance(p_wallet_id, v_delta);

  insert into public.transactions (
    user_id,
    wallet_id,
    category_id,
    transaction_type,
    amount,
    merchant,
    notes,
    source,
    analytics_bucket,
    occurred_at
  )
  values (
    v_user_id,
    p_wallet_id,
    p_category_id,
    lower(p_transaction_type),
    p_amount,
    nullif(trim(coalesce(p_merchant, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    v_source,
    v_analytics_bucket,
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'transaction_id', v_transaction_id,
    'wallet_id', p_wallet_id,
    'new_balance', v_new_balance,
    'analytics_bucket', v_analytics_bucket,
    'source', v_source
  );
end;
$$;

create or replace function public.transfer_between_wallets(
  p_from_wallet_id uuid,
  p_to_wallet_id uuid,
  p_amount numeric,
  p_description text default null,
  p_occurred_at timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_from_balance numeric;
  v_to_balance numeric;
  v_from_name text;
  v_to_name text;
  v_expense_transaction_id uuid;
  v_income_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_from_wallet_id = p_to_wallet_id then
    raise exception 'Source and destination wallet must be different';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select name into v_from_name
  from public.wallets
  where id = p_from_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false;

  if not found then
    raise exception 'Source wallet not found';
  end if;

  select name into v_to_name
  from public.wallets
  where id = p_to_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false;

  if not found then
    raise exception 'Destination wallet not found';
  end if;

  v_from_balance := public.adjust_wallet_balance(p_from_wallet_id, -p_amount);
  v_to_balance := public.adjust_wallet_balance(p_to_wallet_id, p_amount);

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
    p_from_wallet_id,
    'expense',
    p_amount,
    coalesce(nullif(trim(coalesce(p_description, '')), ''), 'Transfer ke ' || v_to_name),
    'transfer',
    'internal_transfer',
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_expense_transaction_id;

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
    p_to_wallet_id,
    'income',
    p_amount,
    coalesce(nullif(trim(coalesce(p_description, '')), ''), 'Transfer dari ' || v_from_name),
    'transfer',
    'internal_transfer',
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_income_transaction_id;

  return jsonb_build_object(
    'expense_transaction_id', v_expense_transaction_id,
    'income_transaction_id', v_income_transaction_id,
    'from_wallet_balance', v_from_balance,
    'to_wallet_balance', v_to_balance,
    'transfer_volume', p_amount
  );
end;
$$;

create or replace function public.contribute_to_goal(
  p_goal_id uuid,
  p_amount numeric,
  p_wallet_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_goal goals%rowtype;
  v_new_amount numeric;
  v_wallet_balance numeric;
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if p_wallet_id is null then
    raise exception 'Wallet is required';
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

  v_wallet_balance := public.adjust_wallet_balance(p_wallet_id, -p_amount);
  v_new_amount := coalesce(v_goal.current_amount, 0) + p_amount;

  update public.goals
  set current_amount = v_new_amount,
      status = case
        when v_goal.target_amount is not null and v_new_amount >= v_goal.target_amount then 'completed'
        else 'active'
      end
  where id = p_goal_id
    and user_id = v_user_id;

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
    p_wallet_id,
    'expense',
    p_amount,
    'Setoran target ' || v_goal.name,
    'goal_contribution',
    'savings',
    timezone('utc', now())
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'goal_id', p_goal_id,
    'goal_name', v_goal.name,
    'new_goal_amount', v_new_amount,
    'wallet_id', p_wallet_id,
    'wallet_balance', v_wallet_balance,
    'transaction_id', v_transaction_id
  );
end;
$$;

create or replace function public.create_goal_with_contribution(
  p_name text,
  p_target_amount numeric,
  p_deadline date default null,
  p_icon text default '🎯',
  p_initial_amount numeric default 0,
  p_wallet_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_goal_id uuid;
  v_wallet_balance numeric := null;
  v_transaction_id uuid := null;
  v_goal_name text := trim(p_name);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Goal name is required';
  end if;

  if p_target_amount is null or p_target_amount <= 0 then
    raise exception 'Target amount must be greater than zero';
  end if;

  if coalesce(p_initial_amount, 0) < 0 then
    raise exception 'Initial amount must not be negative';
  end if;

  if coalesce(p_initial_amount, 0) > 0 and p_wallet_id is null then
    raise exception 'Wallet is required for an initial contribution';
  end if;

  insert into public.goals (
    user_id,
    name,
    target_amount,
    current_amount,
    deadline,
    icon,
    status
  )
  values (
    v_user_id,
    v_goal_name,
    p_target_amount,
    coalesce(p_initial_amount, 0),
    p_deadline,
    coalesce(nullif(trim(coalesce(p_icon, '')), ''), '🎯'),
    case
      when coalesce(p_initial_amount, 0) >= p_target_amount then 'completed'
      else 'active'
    end
  )
  returning id into v_goal_id;

  if coalesce(p_initial_amount, 0) > 0 then
    v_wallet_balance := public.adjust_wallet_balance(p_wallet_id, -p_initial_amount);

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
      p_wallet_id,
      'expense',
      p_initial_amount,
      'Setoran awal target ' || v_goal_name,
      'goal_initial_contribution',
      'savings',
      timezone('utc', now())
    )
    returning id into v_transaction_id;
  end if;

  return jsonb_build_object(
    'goal_id', v_goal_id,
    'goal_name', v_goal_name,
    'target_amount', p_target_amount,
    'initial_amount', coalesce(p_initial_amount, 0),
    'wallet_id', p_wallet_id,
    'wallet_balance', v_wallet_balance,
    'transaction_id', v_transaction_id
  );
end;
$$;

create or replace function public.create_wallet_with_opening_balance(
  p_name text,
  p_initial_balance numeric default 0,
  p_wallet_type text default 'cash',
  p_tone text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_wallet public.wallets%rowtype;
  v_transaction_id uuid := null;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Wallet name is required';
  end if;

  if coalesce(p_initial_balance, 0) < 0 then
    raise exception 'Initial balance must not be negative';
  end if;

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
    trim(p_name),
    coalesce(nullif(trim(coalesce(p_wallet_type, '')), ''), 'cash'),
    coalesce(p_initial_balance, 0),
    coalesce(p_initial_balance, 0),
    coalesce(p_tone, '#0F172A')
  )
  returning * into v_wallet;

  if coalesce(p_initial_balance, 0) > 0 then
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
      p_initial_balance,
      'Saldo awal ' || v_wallet.name,
      'wallet_opening_balance',
      'opening_balance',
      timezone('utc', now())
    )
    returning id into v_transaction_id;
  end if;

  return jsonb_build_object(
    'wallet_id', v_wallet.id,
    'wallet_name', v_wallet.name,
    'wallet_type', v_wallet.wallet_type,
    'initial_balance', v_wallet.initial_balance,
    'current_balance', v_wallet.current_balance,
    'tone', v_wallet.tone,
    'transaction_id', v_transaction_id
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
  v_user_id uuid := public.current_user_id();
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
      'topExpenseCategories', '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.create_wallet_with_opening_balance(text, numeric, text, text) from public;
revoke all on function public.get_analytics_snapshot(timestamptz, timestamptz) from public;

grant execute on function public.create_wallet_with_opening_balance(text, numeric, text, text) to authenticated, service_role;
grant execute on function public.get_analytics_snapshot(timestamptz, timestamptz) to authenticated, service_role;

-- Migration: 20260414173000_ai_analytics_query_support.sql
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
  v_user_id uuid := public.current_user_id();
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

-- Migration: 20260414193000_ledger_guardrails_and_goal_refunds.sql
drop policy if exists "Users can delete own transactions" on public.transactions;

drop policy if exists "Users can manage their own goals" on public.goals;

create policy "Users can view own goals" on public.goals
  for select
  using (public.current_user_id() = user_id);

create policy "Users can insert own goals" on public.goals
  for insert
  with check (public.current_user_id() = user_id);

create policy "Users can update own goals" on public.goals
  for update
  using (public.current_user_id() = user_id)
  with check (public.current_user_id() = user_id);

create or replace function public.delete_transaction_and_revert_balance(
  p_transaction_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
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
  v_user_id uuid := public.current_user_id();
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
  v_user_id uuid := public.current_user_id();
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

-- Migration: 20260414200000_wallet_lifecycle_guardrails.sql
drop policy if exists "Users can delete own wallets" on public.wallets;

create or replace function public.archive_wallet_safely(
  p_wallet_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_wallet public.wallets%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into v_wallet
  from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false
  for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  if coalesce(v_wallet.current_balance, 0) <> 0 then
    raise exception 'Wallet masih memiliki saldo. Pindahkan atau nolkan dulu sebelum diarsipkan.';
  end if;

  update public.wallets
  set is_archived = true,
      updated_at = timezone('utc', now())
  where id = p_wallet_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'wallet_id', v_wallet.id,
    'wallet_name', v_wallet.name,
    'archived', true
  );
end;
$$;

create or replace function public.delete_wallet_permanently_safe(
  p_wallet_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_wallet public.wallets%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into v_wallet
  from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  if coalesce(v_wallet.current_balance, 0) <> 0 then
    raise exception 'Wallet masih memiliki saldo dan tidak bisa dihapus permanen.';
  end if;

  if exists (
    select 1
    from public.transactions
    where wallet_id = p_wallet_id
      and user_id = v_user_id
    limit 1
  ) then
    raise exception 'Wallet dengan riwayat ledger tidak bisa dihapus permanen. Arsipkan saja jika sudah tidak dipakai.';
  end if;

  delete from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'wallet_id', v_wallet.id,
    'wallet_name', v_wallet.name,
    'deleted', true
  );
end;
$$;

revoke all on function public.archive_wallet_safely(uuid) from public;
revoke all on function public.delete_wallet_permanently_safe(uuid) from public;

grant execute on function public.archive_wallet_safely(uuid) to authenticated, service_role;
grant execute on function public.delete_wallet_permanently_safe(uuid) to authenticated, service_role;

-- Migration: 20260414213000_goal_withdrawals.sql
create or replace function public.withdraw_from_goal(
  p_goal_id uuid,
  p_amount numeric,
  p_wallet_id uuid,
  p_description text default null,
  p_occurred_at timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_goal public.goals%rowtype;
  v_wallet public.wallets%rowtype;
  v_new_goal_amount numeric;
  v_wallet_balance numeric;
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if p_wallet_id is null then
    raise exception 'Wallet is required';
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

  if coalesce(v_goal.current_amount, 0) < p_amount then
    raise exception 'Goal balance is insufficient';
  end if;

  select *
    into v_wallet
  from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false
  for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  v_new_goal_amount := coalesce(v_goal.current_amount, 0) - p_amount;
  v_wallet_balance := public.adjust_wallet_balance(p_wallet_id, p_amount);

  update public.goals
  set current_amount = v_new_goal_amount,
      status = case
        when v_goal.target_amount is not null and v_new_goal_amount >= v_goal.target_amount then 'completed'
        else 'active'
      end,
      updated_at = timezone('utc', now())
  where id = p_goal_id
    and user_id = v_user_id;

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
    p_wallet_id,
    'income',
    p_amount,
    coalesce(nullif(trim(coalesce(p_description, '')), ''), 'Pencairan target ' || v_goal.name),
    'goal_withdrawal',
    'savings',
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'goal_id', p_goal_id,
    'goal_name', v_goal.name,
    'new_goal_amount', v_new_goal_amount,
    'wallet_id', p_wallet_id,
    'wallet_name', v_wallet.name,
    'wallet_balance', v_wallet_balance,
    'transaction_id', v_transaction_id
  );
end;
$$;

revoke all on function public.withdraw_from_goal(uuid, numeric, uuid, text, timestamptz) from public;

grant execute on function public.withdraw_from_goal(uuid, numeric, uuid, text, timestamptz) to authenticated, service_role;

-- Migration: 20260414223000_input_hardening_stage1.sql
alter table public.chat_messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;


create or replace function public.normalize_entity_name(p_name text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(lower(trim(coalesce(p_name, ''))), '\s+', ' ', 'g'), '')
$$;

create or replace function public.ensure_default_wallet()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_wallet public.wallets%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform 1
  from public.profiles
  where id = v_user_id
  for update;

  select *
    into v_wallet
  from public.wallets
  where user_id = v_user_id
    and coalesce(is_archived, false) = false
  order by
    case when lower(name) = 'tunai' then 0 else 1 end,
    created_at asc
  limit 1;

  if found then
    return jsonb_build_object(
      'wallet_id', v_wallet.id,
      'wallet_name', v_wallet.name,
      'created', false
    );
  end if;

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

  return jsonb_build_object(
    'wallet_id', v_wallet.id,
    'wallet_name', v_wallet.name,
    'created', true
  );
end;
$$;

create or replace function public.get_name_conflicts()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_wallet_conflicts jsonb := '[]'::jsonb;
  v_goal_conflicts jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  with wallet_groups as (
    select
      public.normalize_entity_name(name) as normalized_name,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'currentBalance', current_balance,
          'isArchived', coalesce(is_archived, false)
        )
        order by created_at asc
      ) as items,
      count(*) filter (where coalesce(is_archived, false) = false) as active_count
    from public.wallets
    where user_id = v_user_id
      and public.normalize_entity_name(name) is not null
    group by public.normalize_entity_name(name)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'normalizedName', normalized_name,
        'items', items
      )
      order by normalized_name asc
    ),
    '[]'::jsonb
  )
  into v_wallet_conflicts
  from wallet_groups
  where active_count > 1;

  with goal_groups as (
    select
      public.normalize_entity_name(name) as normalized_name,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'status', status,
          'currentAmount', current_amount,
          'targetAmount', target_amount
        )
        order by created_at asc
      ) as items,
      count(*) filter (where coalesce(status, 'active') <> 'cancelled') as active_count
    from public.goals
    where user_id = v_user_id
      and public.normalize_entity_name(name) is not null
    group by public.normalize_entity_name(name)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'normalizedName', normalized_name,
        'items', items
      )
      order by normalized_name asc
    ),
    '[]'::jsonb
  )
  into v_goal_conflicts
  from goal_groups
  where active_count > 1;

  return jsonb_build_object(
    'wallets', v_wallet_conflicts,
    'goals', v_goal_conflicts
  );
end;
$$;

create or replace function public.rename_wallet(
  p_wallet_id uuid,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_wallet public.wallets%rowtype;
  v_normalized_name text := public.normalize_entity_name(p_name);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_normalized_name is null then
    raise exception 'Wallet name is required';
  end if;

  perform 1
  from public.profiles
  where id = v_user_id
  for update;

  select *
    into v_wallet
  from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false
  for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  if exists (
    select 1
    from public.wallets
    where user_id = v_user_id
      and id <> p_wallet_id
      and coalesce(is_archived, false) = false
      and public.normalize_entity_name(name) = v_normalized_name
  ) then
    raise exception 'Wallet name is already in use';
  end if;

  update public.wallets
  set name = trim(p_name),
      updated_at = timezone('utc', now())
  where id = p_wallet_id
    and user_id = v_user_id
  returning * into v_wallet;

  return jsonb_build_object(
    'wallet_id', v_wallet.id,
    'wallet_name', v_wallet.name
  );
end;
$$;

create or replace function public.rename_goal(
  p_goal_id uuid,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_goal public.goals%rowtype;
  v_normalized_name text := public.normalize_entity_name(p_name);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_normalized_name is null then
    raise exception 'Goal name is required';
  end if;

  perform 1
  from public.profiles
  where id = v_user_id
  for update;

  select *
    into v_goal
  from public.goals
  where id = p_goal_id
    and user_id = v_user_id
    and coalesce(status, 'active') <> 'cancelled'
  for update;

  if not found then
    raise exception 'Goal not found';
  end if;

  if exists (
    select 1
    from public.goals
    where user_id = v_user_id
      and id <> p_goal_id
      and coalesce(status, 'active') <> 'cancelled'
      and public.normalize_entity_name(name) = v_normalized_name
  ) then
    raise exception 'Goal name is already in use';
  end if;

  update public.goals
  set name = trim(p_name),
      updated_at = timezone('utc', now())
  where id = p_goal_id
    and user_id = v_user_id
  returning * into v_goal;

  return jsonb_build_object(
    'goal_id', v_goal.id,
    'goal_name', v_goal.name
  );
end;
$$;

create or replace function public.adjust_wallet_balance(
  p_wallet_id uuid,
  p_delta numeric
)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_current_balance numeric;
  v_new_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_delta is null then
    raise exception 'Delta is required';
  end if;

  select current_balance
    into v_current_balance
  from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false
  for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  v_new_balance := coalesce(v_current_balance, 0) + p_delta;

  if v_new_balance < 0 then
    raise exception 'Insufficient wallet balance';
  end if;

  update public.wallets
  set current_balance = v_new_balance,
      updated_at = timezone('utc', now())
  where id = p_wallet_id
    and user_id = v_user_id;

  return v_new_balance;
end;
$$;

create or replace function public.record_transaction(
  p_wallet_id uuid,
  p_category_id uuid default null,
  p_transaction_type text default 'expense',
  p_amount numeric default 0,
  p_merchant text default null,
  p_notes text default null,
  p_source text default 'chat',
  p_occurred_at timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_delta numeric;
  v_transaction_id uuid;
  v_new_balance numeric;
  v_source text := lower(coalesce(nullif(trim(coalesce(p_source, '')), ''), 'chat'));
  v_analytics_bucket text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if lower(coalesce(p_transaction_type, '')) not in ('income', 'expense') then
    raise exception 'Invalid transaction type';
  end if;

  if p_category_id is not null and not exists (
    select 1
    from public.categories
    where id = p_category_id
      and user_id = v_user_id
  ) then
    raise exception 'Category not found';
  end if;

  v_delta := case
    when lower(p_transaction_type) = 'income' then p_amount
    else -p_amount
  end;

  v_analytics_bucket := case
    when v_source in ('goal_contribution', 'goal_initial_contribution', 'goal_refund', 'goal_withdrawal') then 'savings'
    when v_source = 'transfer' then 'internal_transfer'
    when v_source = 'wallet_opening_balance' then 'opening_balance'
    when lower(p_transaction_type) = 'income' then 'income'
    else 'expense'
  end;

  v_new_balance := public.adjust_wallet_balance(p_wallet_id, v_delta);

  insert into public.transactions (
    user_id,
    wallet_id,
    category_id,
    transaction_type,
    amount,
    merchant,
    notes,
    source,
    analytics_bucket,
    occurred_at
  )
  values (
    v_user_id,
    p_wallet_id,
    p_category_id,
    lower(p_transaction_type),
    p_amount,
    nullif(trim(coalesce(p_merchant, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    v_source,
    v_analytics_bucket,
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'transaction_id', v_transaction_id,
    'wallet_id', p_wallet_id,
    'new_balance', v_new_balance,
    'analytics_bucket', v_analytics_bucket,
    'source', v_source
  );
end;
$$;

create or replace function public.transfer_between_wallets(
  p_from_wallet_id uuid,
  p_to_wallet_id uuid,
  p_amount numeric,
  p_description text default null,
  p_occurred_at timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_from_balance numeric;
  v_to_balance numeric;
  v_from_name text;
  v_to_name text;
  v_expense_transaction_id uuid;
  v_income_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_from_wallet_id = p_to_wallet_id then
    raise exception 'Source and destination wallet must be different';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select name into v_from_name
  from public.wallets
  where id = p_from_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false;

  if not found then
    raise exception 'Source wallet not found';
  end if;

  select name into v_to_name
  from public.wallets
  where id = p_to_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false;

  if not found then
    raise exception 'Destination wallet not found';
  end if;

  v_from_balance := public.adjust_wallet_balance(p_from_wallet_id, -p_amount);
  v_to_balance := public.adjust_wallet_balance(p_to_wallet_id, p_amount);

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
    p_from_wallet_id,
    'expense',
    p_amount,
    coalesce(nullif(trim(coalesce(p_description, '')), ''), 'Transfer ke ' || v_to_name),
    'transfer',
    'internal_transfer',
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_expense_transaction_id;

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
    p_to_wallet_id,
    'income',
    p_amount,
    coalesce(nullif(trim(coalesce(p_description, '')), ''), 'Transfer dari ' || v_from_name),
    'transfer',
    'internal_transfer',
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_income_transaction_id;

  return jsonb_build_object(
    'expense_transaction_id', v_expense_transaction_id,
    'income_transaction_id', v_income_transaction_id,
    'from_wallet_balance', v_from_balance,
    'to_wallet_balance', v_to_balance,
    'transfer_volume', p_amount
  );
end;
$$;

create or replace function public.contribute_to_goal(
  p_goal_id uuid,
  p_amount numeric,
  p_wallet_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_goal public.goals%rowtype;
  v_new_amount numeric;
  v_wallet_balance numeric;
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if p_wallet_id is null then
    raise exception 'Wallet is required';
  end if;

  select *
    into v_goal
  from public.goals
  where id = p_goal_id
    and user_id = v_user_id
    and coalesce(status, 'active') <> 'cancelled'
  for update;

  if not found then
    raise exception 'Goal not found';
  end if;

  v_wallet_balance := public.adjust_wallet_balance(p_wallet_id, -p_amount);
  v_new_amount := coalesce(v_goal.current_amount, 0) + p_amount;

  update public.goals
  set current_amount = v_new_amount,
      status = case
        when v_goal.target_amount is not null and v_new_amount >= v_goal.target_amount then 'completed'
        else 'active'
      end,
      updated_at = timezone('utc', now())
  where id = p_goal_id
    and user_id = v_user_id;

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
    p_wallet_id,
    'expense',
    p_amount,
    'Setoran target ' || v_goal.name,
    'goal_contribution',
    'savings',
    timezone('utc', now())
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'goal_id', p_goal_id,
    'goal_name', v_goal.name,
    'new_goal_amount', v_new_amount,
    'wallet_id', p_wallet_id,
    'wallet_balance', v_wallet_balance,
    'transaction_id', v_transaction_id
  );
end;
$$;

create or replace function public.create_goal_with_contribution(
  p_name text,
  p_target_amount numeric,
  p_deadline date default null,
  p_icon text default '🎯',
  p_initial_amount numeric default 0,
  p_wallet_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_goal_id uuid;
  v_wallet_balance numeric := null;
  v_transaction_id uuid := null;
  v_goal_name text := trim(p_name);
  v_normalized_name text := public.normalize_entity_name(p_name);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_normalized_name is null then
    raise exception 'Goal name is required';
  end if;

  if p_target_amount is null or p_target_amount <= 0 then
    raise exception 'Target amount must be greater than zero';
  end if;

  if coalesce(p_initial_amount, 0) < 0 then
    raise exception 'Initial amount must not be negative';
  end if;

  if coalesce(p_initial_amount, 0) > 0 and p_wallet_id is null then
    raise exception 'Wallet is required for an initial contribution';
  end if;

  perform 1
  from public.profiles
  where id = v_user_id
  for update;

  if exists (
    select 1
    from public.goals
    where user_id = v_user_id
      and coalesce(status, 'active') <> 'cancelled'
      and public.normalize_entity_name(name) = v_normalized_name
  ) then
    raise exception 'Goal name is already in use';
  end if;

  insert into public.goals (
    user_id,
    name,
    target_amount,
    current_amount,
    deadline,
    icon,
    status
  )
  values (
    v_user_id,
    v_goal_name,
    p_target_amount,
    coalesce(p_initial_amount, 0),
    p_deadline,
    coalesce(nullif(trim(coalesce(p_icon, '')), ''), '🎯'),
    case
      when coalesce(p_initial_amount, 0) >= p_target_amount then 'completed'
      else 'active'
    end
  )
  returning id into v_goal_id;

  if coalesce(p_initial_amount, 0) > 0 then
    v_wallet_balance := public.adjust_wallet_balance(p_wallet_id, -p_initial_amount);

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
      p_wallet_id,
      'expense',
      p_initial_amount,
      'Setoran awal target ' || v_goal_name,
      'goal_initial_contribution',
      'savings',
      timezone('utc', now())
    )
    returning id into v_transaction_id;
  end if;

  return jsonb_build_object(
    'goal_id', v_goal_id,
    'goal_name', v_goal_name,
    'target_amount', p_target_amount,
    'initial_amount', coalesce(p_initial_amount, 0),
    'wallet_id', p_wallet_id,
    'wallet_balance', v_wallet_balance,
    'transaction_id', v_transaction_id
  );
end;
$$;

create or replace function public.create_wallet_with_opening_balance(
  p_name text,
  p_initial_balance numeric default 0,
  p_wallet_type text default 'cash',
  p_tone text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_wallet public.wallets%rowtype;
  v_transaction_id uuid := null;
  v_normalized_name text := public.normalize_entity_name(p_name);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_normalized_name is null then
    raise exception 'Wallet name is required';
  end if;

  if coalesce(p_initial_balance, 0) < 0 then
    raise exception 'Initial balance must not be negative';
  end if;

  perform 1
  from public.profiles
  where id = v_user_id
  for update;

  if exists (
    select 1
    from public.wallets
    where user_id = v_user_id
      and coalesce(is_archived, false) = false
      and public.normalize_entity_name(name) = v_normalized_name
  ) then
    raise exception 'Wallet name is already in use';
  end if;

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
    trim(p_name),
    coalesce(nullif(trim(coalesce(p_wallet_type, '')), ''), 'cash'),
    coalesce(p_initial_balance, 0),
    coalesce(p_initial_balance, 0),
    coalesce(p_tone, '#0F172A')
  )
  returning * into v_wallet;

  if coalesce(p_initial_balance, 0) > 0 then
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
      p_initial_balance,
      'Saldo awal ' || v_wallet.name,
      'wallet_opening_balance',
      'opening_balance',
      timezone('utc', now())
    )
    returning id into v_transaction_id;
  end if;

  return jsonb_build_object(
    'wallet_id', v_wallet.id,
    'wallet_name', v_wallet.name,
    'wallet_type', v_wallet.wallet_type,
    'initial_balance', v_wallet.initial_balance,
    'current_balance', v_wallet.current_balance,
    'tone', v_wallet.tone,
    'transaction_id', v_transaction_id
  );
end;
$$;

do $$
begin
  if not exists (
    select 1
    from (
      select user_id, public.normalize_entity_name(name)
      from public.wallets
      where coalesce(is_archived, false) = false
      group by user_id, public.normalize_entity_name(name)
      having count(*) > 1
    ) duplicates
  ) then
    if not exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and indexname = 'wallets_user_normalized_name_active_idx'
    ) then
      execute '
        create unique index wallets_user_normalized_name_active_idx
        on public.wallets (user_id, public.normalize_entity_name(name))
        where coalesce(is_archived, false) = false
      ';
    end if;
  else
    raise notice 'Skipping wallet unique index because duplicate active wallet names still exist.';
  end if;

  if not exists (
    select 1
    from (
      select user_id, public.normalize_entity_name(name)
      from public.goals
      where coalesce(status, 'active') <> 'cancelled'
      group by user_id, public.normalize_entity_name(name)
      having count(*) > 1
    ) duplicates
  ) then
    if not exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and indexname = 'goals_user_normalized_name_active_idx'
    ) then
      execute '
        create unique index goals_user_normalized_name_active_idx
        on public.goals (user_id, public.normalize_entity_name(name))
        where coalesce(status, ''active'') <> ''cancelled''
      ';
    end if;
  else
    raise notice 'Skipping goal unique index because duplicate active goal names still exist.';
  end if;
end;
$$;

revoke all on function public.normalize_entity_name(text) from public;
revoke all on function public.ensure_default_wallet() from public;
revoke all on function public.get_name_conflicts() from public;
revoke all on function public.rename_wallet(uuid, text) from public;
revoke all on function public.rename_goal(uuid, text) from public;

grant execute on function public.normalize_entity_name(text) to authenticated, service_role;
grant execute on function public.ensure_default_wallet() to authenticated, service_role;
grant execute on function public.get_name_conflicts() to authenticated, service_role;
grant execute on function public.rename_wallet(uuid, text) to authenticated, service_role;
grant execute on function public.rename_goal(uuid, text) to authenticated, service_role;

-- Migration: 20260415093000_secure_mutation_paths.sql
revoke insert, update, delete on table public.wallets from anon, authenticated;
revoke insert, update, delete on table public.transactions from anon, authenticated;
revoke insert, update, delete on table public.goals from anon, authenticated;

create or replace function public.adjust_wallet_balance(
  p_wallet_id uuid,
  p_delta numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_current_balance numeric;
  v_new_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;

  if p_delta is null then
    raise exception 'Perubahan saldo tidak valid.';
  end if;

  select current_balance
    into v_current_balance
  from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false
  for update;

  if not found then
    raise exception 'Dompet tidak ditemukan atau sudah diarsipkan.';
  end if;

  v_new_balance := coalesce(v_current_balance, 0) + p_delta;

  if v_new_balance < 0 then
    raise exception 'Saldo dompet tidak cukup untuk menyelesaikan aksi ini.';
  end if;

  update public.wallets
  set current_balance = v_new_balance,
      updated_at = timezone('utc', now())
  where id = p_wallet_id
    and user_id = v_user_id;

  return v_new_balance;
end;
$$;

create or replace function public.record_transaction(
  p_wallet_id uuid,
  p_category_id uuid default null,
  p_transaction_type text default 'expense',
  p_amount numeric default 0,
  p_merchant text default null,
  p_notes text default null,
  p_source text default 'chat',
  p_occurred_at timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_delta numeric;
  v_transaction_id uuid;
  v_new_balance numeric;
  v_source text := lower(coalesce(nullif(trim(coalesce(p_source, '')), ''), 'chat'));
  v_analytics_bucket text;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal transaksi harus lebih besar dari nol.';
  end if;

  if lower(coalesce(p_transaction_type, '')) not in ('income', 'expense') then
    raise exception 'Jenis transaksi tidak valid.';
  end if;

  if p_category_id is not null and not exists (
    select 1
    from public.categories
    where id = p_category_id
      and user_id = v_user_id
  ) then
    raise exception 'Kategori transaksi tidak ditemukan.';
  end if;

  v_delta := case
    when lower(p_transaction_type) = 'income' then p_amount
    else -p_amount
  end;

  v_analytics_bucket := case
    when v_source in ('goal_contribution', 'goal_initial_contribution', 'goal_refund', 'goal_withdrawal') then 'savings'
    when v_source = 'transfer' then 'internal_transfer'
    when v_source = 'wallet_opening_balance' then 'opening_balance'
    when lower(p_transaction_type) = 'income' then 'income'
    else 'expense'
  end;

  v_new_balance := public.adjust_wallet_balance(p_wallet_id, v_delta);

  insert into public.transactions (
    user_id,
    wallet_id,
    category_id,
    transaction_type,
    amount,
    merchant,
    notes,
    source,
    analytics_bucket,
    occurred_at
  )
  values (
    v_user_id,
    p_wallet_id,
    p_category_id,
    lower(p_transaction_type),
    p_amount,
    nullif(trim(coalesce(p_merchant, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    v_source,
    v_analytics_bucket,
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'transaction_id', v_transaction_id,
    'wallet_id', p_wallet_id,
    'new_balance', v_new_balance,
    'analytics_bucket', v_analytics_bucket,
    'source', v_source
  );
end;
$$;

create or replace function public.transfer_between_wallets(
  p_from_wallet_id uuid,
  p_to_wallet_id uuid,
  p_amount numeric,
  p_description text default null,
  p_occurred_at timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_from_balance numeric;
  v_to_balance numeric;
  v_from_name text;
  v_to_name text;
  v_expense_transaction_id uuid;
  v_income_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;

  if p_from_wallet_id = p_to_wallet_id then
    raise exception 'Dompet asal dan tujuan harus berbeda.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal transfer harus lebih besar dari nol.';
  end if;

  select name into v_from_name
  from public.wallets
  where id = p_from_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false;

  if not found then
    raise exception 'Dompet asal tidak ditemukan.';
  end if;

  select name into v_to_name
  from public.wallets
  where id = p_to_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false;

  if not found then
    raise exception 'Dompet tujuan tidak ditemukan.';
  end if;

  v_from_balance := public.adjust_wallet_balance(p_from_wallet_id, -p_amount);
  v_to_balance := public.adjust_wallet_balance(p_to_wallet_id, p_amount);

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
    p_from_wallet_id,
    'expense',
    p_amount,
    coalesce(nullif(trim(coalesce(p_description, '')), ''), 'Transfer ke ' || v_to_name),
    'transfer',
    'internal_transfer',
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_expense_transaction_id;

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
    p_to_wallet_id,
    'income',
    p_amount,
    coalesce(nullif(trim(coalesce(p_description, '')), ''), 'Transfer dari ' || v_from_name),
    'transfer',
    'internal_transfer',
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_income_transaction_id;

  return jsonb_build_object(
    'expense_transaction_id', v_expense_transaction_id,
    'income_transaction_id', v_income_transaction_id,
    'from_wallet_balance', v_from_balance,
    'to_wallet_balance', v_to_balance,
    'transfer_volume', p_amount
  );
end;
$$;

create or replace function public.contribute_to_goal(
  p_goal_id uuid,
  p_amount numeric,
  p_wallet_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_goal public.goals%rowtype;
  v_new_amount numeric;
  v_wallet_balance numeric;
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal setoran target harus lebih besar dari nol.';
  end if;

  if p_wallet_id is null then
    raise exception 'Pilih dompet sumber untuk setoran target ini.';
  end if;

  select *
    into v_goal
  from public.goals
  where id = p_goal_id
    and user_id = v_user_id
    and coalesce(status, 'active') <> 'cancelled'
  for update;

  if not found then
    raise exception 'Target tidak ditemukan.';
  end if;

  v_wallet_balance := public.adjust_wallet_balance(p_wallet_id, -p_amount);
  v_new_amount := coalesce(v_goal.current_amount, 0) + p_amount;

  update public.goals
  set current_amount = v_new_amount,
      status = case
        when v_goal.target_amount is not null and v_new_amount >= v_goal.target_amount then 'completed'
        else 'active'
      end,
      updated_at = timezone('utc', now())
  where id = p_goal_id
    and user_id = v_user_id;

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
    p_wallet_id,
    'expense',
    p_amount,
    'Setoran target ' || v_goal.name,
    'goal_contribution',
    'savings',
    timezone('utc', now())
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'goal_id', p_goal_id,
    'goal_name', v_goal.name,
    'new_goal_amount', v_new_amount,
    'wallet_id', p_wallet_id,
    'wallet_balance', v_wallet_balance,
    'transaction_id', v_transaction_id
  );
end;
$$;

create or replace function public.create_goal_with_contribution(
  p_name text,
  p_target_amount numeric,
  p_deadline date default null,
  p_icon text default '🎯',
  p_initial_amount numeric default 0,
  p_wallet_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_goal_id uuid;
  v_wallet_balance numeric := null;
  v_transaction_id uuid := null;
  v_goal_name text := trim(p_name);
  v_normalized_name text := public.normalize_entity_name(p_name);
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;

  if v_normalized_name is null then
    raise exception 'Nama target wajib diisi.';
  end if;

  if p_target_amount is null or p_target_amount <= 0 then
    raise exception 'Nominal target harus lebih besar dari nol.';
  end if;

  if coalesce(p_initial_amount, 0) < 0 then
    raise exception 'Setoran awal tidak boleh negatif.';
  end if;

  if coalesce(p_initial_amount, 0) > 0 and p_wallet_id is null then
    raise exception 'Pilih dompet sumber untuk setoran awal target ini.';
  end if;

  perform 1
  from public.profiles
  where id = v_user_id
  for update;

  if exists (
    select 1
    from public.goals
    where user_id = v_user_id
      and coalesce(status, 'active') <> 'cancelled'
      and public.normalize_entity_name(name) = v_normalized_name
  ) then
    raise exception 'Nama target ini sudah dipakai. Gunakan nama yang lebih spesifik.';
  end if;

  insert into public.goals (
    user_id,
    name,
    target_amount,
    current_amount,
    deadline,
    icon,
    status
  )
  values (
    v_user_id,
    v_goal_name,
    p_target_amount,
    coalesce(p_initial_amount, 0),
    p_deadline,
    coalesce(nullif(trim(coalesce(p_icon, '')), ''), '🎯'),
    case
      when coalesce(p_initial_amount, 0) >= p_target_amount then 'completed'
      else 'active'
    end
  )
  returning id into v_goal_id;

  if coalesce(p_initial_amount, 0) > 0 then
    v_wallet_balance := public.adjust_wallet_balance(p_wallet_id, -p_initial_amount);

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
      p_wallet_id,
      'expense',
      p_initial_amount,
      'Setoran awal target ' || v_goal_name,
      'goal_initial_contribution',
      'savings',
      timezone('utc', now())
    )
    returning id into v_transaction_id;
  end if;

  return jsonb_build_object(
    'goal_id', v_goal_id,
    'goal_name', v_goal_name,
    'target_amount', p_target_amount,
    'initial_amount', coalesce(p_initial_amount, 0),
    'wallet_id', p_wallet_id,
    'wallet_balance', v_wallet_balance,
    'transaction_id', v_transaction_id
  );
end;
$$;

create or replace function public.create_wallet_with_opening_balance(
  p_name text,
  p_initial_balance numeric default 0,
  p_wallet_type text default 'cash',
  p_tone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_wallet public.wallets%rowtype;
  v_transaction_id uuid := null;
  v_normalized_name text := public.normalize_entity_name(p_name);
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;

  if v_normalized_name is null then
    raise exception 'Nama dompet wajib diisi.';
  end if;

  if coalesce(p_initial_balance, 0) < 0 then
    raise exception 'Saldo awal tidak boleh negatif.';
  end if;

  perform 1
  from public.profiles
  where id = v_user_id
  for update;

  if exists (
    select 1
    from public.wallets
    where user_id = v_user_id
      and coalesce(is_archived, false) = false
      and public.normalize_entity_name(name) = v_normalized_name
  ) then
    raise exception 'Nama dompet ini sudah dipakai. Gunakan nama lain agar chat tidak bingung.';
  end if;

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
    trim(p_name),
    coalesce(nullif(trim(coalesce(p_wallet_type, '')), ''), 'cash'),
    coalesce(p_initial_balance, 0),
    coalesce(p_initial_balance, 0),
    coalesce(p_tone, '#0F172A')
  )
  returning * into v_wallet;

  if coalesce(p_initial_balance, 0) > 0 then
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
      p_initial_balance,
      'Saldo awal ' || v_wallet.name,
      'wallet_opening_balance',
      'opening_balance',
      timezone('utc', now())
    )
    returning id into v_transaction_id;
  end if;

  return jsonb_build_object(
    'wallet_id', v_wallet.id,
    'wallet_name', v_wallet.name,
    'wallet_type', v_wallet.wallet_type,
    'initial_balance', v_wallet.initial_balance,
    'current_balance', v_wallet.current_balance,
    'tone', v_wallet.tone,
    'transaction_id', v_transaction_id
  );
end;
$$;

create or replace function public.withdraw_from_goal(
  p_goal_id uuid,
  p_amount numeric,
  p_wallet_id uuid,
  p_description text default null,
  p_occurred_at timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_goal public.goals%rowtype;
  v_wallet public.wallets%rowtype;
  v_new_goal_amount numeric;
  v_wallet_balance numeric;
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal pencairan target harus lebih besar dari nol.';
  end if;

  if p_wallet_id is null then
    raise exception 'Pilih dompet tujuan untuk pencairan target ini.';
  end if;

  select *
    into v_goal
  from public.goals
  where id = p_goal_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Target tidak ditemukan.';
  end if;

  if coalesce(v_goal.current_amount, 0) < p_amount then
    raise exception 'Saldo target tidak cukup untuk dicairkan.';
  end if;

  select *
    into v_wallet
  from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false
  for update;

  if not found then
    raise exception 'Dompet tujuan tidak ditemukan.';
  end if;

  v_new_goal_amount := coalesce(v_goal.current_amount, 0) - p_amount;
  v_wallet_balance := public.adjust_wallet_balance(p_wallet_id, p_amount);

  update public.goals
  set current_amount = v_new_goal_amount,
      status = case
        when v_goal.target_amount is not null and v_new_goal_amount >= v_goal.target_amount then 'completed'
        else 'active'
      end,
      updated_at = timezone('utc', now())
  where id = p_goal_id
    and user_id = v_user_id;

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
    p_wallet_id,
    'income',
    p_amount,
    coalesce(nullif(trim(coalesce(p_description, '')), ''), 'Pencairan target ' || v_goal.name),
    'goal_withdrawal',
    'savings',
    coalesce(p_occurred_at, timezone('utc', now()))
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'goal_id', p_goal_id,
    'goal_name', v_goal.name,
    'new_goal_amount', v_new_goal_amount,
    'wallet_id', p_wallet_id,
    'wallet_name', v_wallet.name,
    'wallet_balance', v_wallet_balance,
    'transaction_id', v_transaction_id
  );
end;
$$;

revoke all on function public.adjust_wallet_balance(uuid, numeric) from public;
revoke all on function public.record_transaction(uuid, uuid, text, numeric, text, text, text, timestamptz) from public;
revoke all on function public.transfer_between_wallets(uuid, uuid, numeric, text, timestamptz) from public;
revoke all on function public.contribute_to_goal(uuid, numeric, uuid) from public;
revoke all on function public.create_goal_with_contribution(text, numeric, date, text, numeric, uuid) from public;
revoke all on function public.create_wallet_with_opening_balance(text, numeric, text, text) from public;
revoke all on function public.withdraw_from_goal(uuid, numeric, uuid, text, timestamptz) from public;

grant execute on function public.adjust_wallet_balance(uuid, numeric) to authenticated, service_role;
grant execute on function public.record_transaction(uuid, uuid, text, numeric, text, text, text, timestamptz) to authenticated, service_role;
grant execute on function public.transfer_between_wallets(uuid, uuid, numeric, text, timestamptz) to authenticated, service_role;
grant execute on function public.contribute_to_goal(uuid, numeric, uuid) to authenticated, service_role;
grant execute on function public.create_goal_with_contribution(text, numeric, date, text, numeric, uuid) to authenticated, service_role;
grant execute on function public.create_wallet_with_opening_balance(text, numeric, text, text) to authenticated, service_role;
grant execute on function public.withdraw_from_goal(uuid, numeric, uuid, text, timestamptz) to authenticated, service_role;

-- Migration: 20260415113000_chat_learning_rules.sql
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
  using (public.current_user_id() = user_id);

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
  v_user_id uuid := public.current_user_id();
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

-- Migration: 20260418101500_ai_learning_hints.sql
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
  v_user_id uuid := public.current_user_id();
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

-- Migration: 20260425010500_fix_delete_guardrails_and_learning_rules.sql
create or replace function public.delete_transaction_and_revert_balance(
  p_transaction_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
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
  v_user_id uuid := public.current_user_id();
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

-- Migration: 20260425012500_tighten_learning_keywords.sql
delete from public.smart_category_rules
where lower(keyword) in (
  'menggunakan',
  'gunakan',
  'memakai',
  'dipakai',
  'dipake',
  'terpakai'
)
or lower(keyword) ~ '^\d+[[:alpha:]]+$';

delete from public.smart_wallet_rules
where lower(keyword) in (
  'menggunakan',
  'gunakan',
  'memakai',
  'dipakai',
  'dipake',
  'terpakai'
)
or lower(keyword) ~ '^\d+[[:alpha:]]+$';

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
  v_user_id uuid := public.current_user_id();
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
        and keyword !~ '^\d+[[:alpha:]]+$'
        and keyword not in (
          'rp', 'idr', 'k', 'rb', 'ribu', 'jt', 'juta', 'm',
          'beli', 'bayar', 'keluar', 'masuk', 'gaji', 'bonus',
          'tabung', 'transfer', 'dari', 'ke', 'untuk', 'pakai', 'pake',
          'menggunakan', 'gunakan', 'memakai', 'dipakai', 'dipake', 'terpakai',
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
        and keyword !~ '^\d+[[:alpha:]]+$'
        and keyword not in (
          'rp', 'idr', 'k', 'rb', 'ribu', 'jt', 'juta', 'm',
          'beli', 'bayar', 'keluar', 'masuk', 'gaji', 'bonus',
          'tabung', 'transfer', 'dari', 'ke', 'untuk', 'pakai', 'pake',
          'menggunakan', 'gunakan', 'memakai', 'dipakai', 'dipake', 'terpakai',
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

revoke all on function public.learn_from_chat_input(text, uuid, uuid, text[], text[]) from public;
grant execute on function public.learn_from_chat_input(text, uuid, uuid, text[], text[]) to authenticated, service_role;

-- Migration: 20260425023500_allow_wallet_archival_with_balance.sql
create or replace function public.archive_wallet_safely(
  p_wallet_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_wallet public.wallets%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into v_wallet
  from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = false
  for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  update public.wallets
  set is_archived = true,
      updated_at = timezone('utc', now())
  where id = p_wallet_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'wallet_id', v_wallet.id,
    'wallet_name', v_wallet.name,
    'current_balance', coalesce(v_wallet.current_balance, 0),
    'archived', true
  );
end;
$$;

revoke all on function public.archive_wallet_safely(uuid) from public;
grant execute on function public.archive_wallet_safely(uuid) to authenticated, service_role;

-- Migration: 20260425032000_restore_wallet_safely.sql
create or replace function public.restore_wallet_safely(
  p_wallet_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_wallet public.wallets%rowtype;
  v_normalized_name text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into v_wallet
  from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id
    and coalesce(is_archived, false) = true
  for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  v_normalized_name := public.normalize_entity_name(v_wallet.name);

  if exists (
    select 1
    from public.wallets
    where user_id = v_user_id
      and id <> p_wallet_id
      and coalesce(is_archived, false) = false
      and public.normalize_entity_name(name) = v_normalized_name
  ) then
    raise exception 'Wallet name is already in use';
  end if;

  update public.wallets
  set is_archived = false,
      updated_at = timezone('utc', now())
  where id = p_wallet_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'wallet_id', v_wallet.id,
    'wallet_name', v_wallet.name,
    'restored', true
  );
end;
$$;

revoke all on function public.restore_wallet_safely(uuid) from public;
grant execute on function public.restore_wallet_safely(uuid) to authenticated, service_role;

-- Migration: 20260425090000_allow_wallet_hard_delete_with_history.sql
create or replace function public.delete_wallet_permanently_safe(
  p_wallet_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_wallet public.wallets%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into v_wallet
  from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  delete from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'wallet_id', v_wallet.id,
    'wallet_name', v_wallet.name,
    'deleted', true
  );
end;
$$;

revoke all on function public.delete_wallet_permanently_safe(uuid) from public;
grant execute on function public.delete_wallet_permanently_safe(uuid) to authenticated, service_role;

-- Migration: 20260425124000_force_wallet_hard_delete.sql
create or replace function public.delete_wallet_permanently_safe(
  p_wallet_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_wallet public.wallets%rowtype;
  v_deleted_transactions integer := 0;
  v_deleted_wallet_rules integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into v_wallet
  from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  if to_regclass('public.smart_wallet_rules') is not null then
    execute
      'delete from public.smart_wallet_rules where wallet_id = $1 and user_id = $2'
      using p_wallet_id, v_user_id;
    get diagnostics v_deleted_wallet_rules = row_count;
  end if;

  if to_regclass('public.transactions') is not null then
    execute
      'delete from public.transactions where wallet_id = $1 and user_id = $2'
      using p_wallet_id, v_user_id;
    get diagnostics v_deleted_transactions = row_count;
  end if;

  delete from public.wallets
  where id = p_wallet_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'wallet_id', v_wallet.id,
    'wallet_name', v_wallet.name,
    'deleted', true,
    'deleted_transactions', v_deleted_transactions,
    'deleted_wallet_rules', v_deleted_wallet_rules
  );
end;
$$;

revoke all on function public.delete_wallet_permanently_safe(uuid) from public;
grant execute on function public.delete_wallet_permanently_safe(uuid) to authenticated, service_role;

grant delete on table public.wallets to authenticated, service_role;

drop policy if exists "Users can delete own wallets" on public.wallets;

create policy "Users can delete own wallets" on public.wallets
  for delete
  using (public.current_user_id() = user_id);

-- Migration: 20260425132000_harden_rls_advisor_warnings.sql
alter function public.normalize_entity_name(text) set search_path = public;

drop policy if exists "Users can manage their own budgets" on public.budgets;
create policy "Users can manage their own budgets" on public.budgets
  for all
  using ((select public.current_user_id()) = user_id)
  with check (
    (select public.current_user_id()) = user_id
    and exists (
      select 1
      from public.categories
      where categories.id = budgets.category_id
        and categories.user_id = (select public.current_user_id())
    )
  );

drop policy if exists "Users can view own categories" on public.categories;
create policy "Users can view own categories" on public.categories
  for select
  using ((select public.current_user_id()) = user_id);

drop policy if exists "Users can insert own categories" on public.categories;
create policy "Users can insert own categories" on public.categories
  for insert
  with check ((select public.current_user_id()) = user_id);

drop policy if exists "Users can update own categories" on public.categories;
create policy "Users can update own categories" on public.categories
  for update
  using ((select public.current_user_id()) = user_id);

drop policy if exists "Users can delete own categories" on public.categories;
create policy "Users can delete own categories" on public.categories
  for delete
  using ((select public.current_user_id()) = user_id);

drop policy if exists "Users can view their own messages" on public.chat_messages;
create policy "Users can view their own messages" on public.chat_messages
  for select
  using ((select public.current_user_id()) = user_id);

drop policy if exists "Users can insert their own messages" on public.chat_messages;
create policy "Users can insert their own messages" on public.chat_messages
  for insert
  with check ((select public.current_user_id()) = user_id);

drop policy if exists "Users can delete their own messages" on public.chat_messages;
create policy "Users can delete their own messages" on public.chat_messages
  for delete
  using ((select public.current_user_id()) = user_id);

drop policy if exists "Users can view own goals" on public.goals;
create policy "Users can view own goals" on public.goals
  for select
  using ((select public.current_user_id()) = user_id);

drop policy if exists "Users can insert own goals" on public.goals;
create policy "Users can insert own goals" on public.goals
  for insert
  with check ((select public.current_user_id()) = user_id);

drop policy if exists "Users can update own goals" on public.goals;
create policy "Users can update own goals" on public.goals
  for update
  using ((select public.current_user_id()) = user_id)
  with check ((select public.current_user_id()) = user_id);

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select
  using ((select public.current_user_id()) = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert
  with check ((select public.current_user_id()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update
  using ((select public.current_user_id()) = id);

drop policy if exists "Users can view own rules" on public.smart_category_rules;
create policy "Users can view own rules" on public.smart_category_rules
  for select
  using ((select public.current_user_id()) = user_id);

drop policy if exists "Users can insert own rules" on public.smart_category_rules;
create policy "Users can insert own rules" on public.smart_category_rules
  for insert
  with check (
    (select public.current_user_id()) = user_id
    and exists (
      select 1
      from public.categories
      where categories.id = smart_category_rules.category_id
        and categories.user_id = (select public.current_user_id())
    )
  );

drop policy if exists "Users can update own rules" on public.smart_category_rules;
create policy "Users can update own rules" on public.smart_category_rules
  for update
  using ((select public.current_user_id()) = user_id)
  with check (
    (select public.current_user_id()) = user_id
    and exists (
      select 1
      from public.categories
      where categories.id = smart_category_rules.category_id
        and categories.user_id = (select public.current_user_id())
    )
  );

drop policy if exists "Users can delete own rules" on public.smart_category_rules;
create policy "Users can delete own rules" on public.smart_category_rules
  for delete
  using ((select public.current_user_id()) = user_id);

drop policy if exists "Users can view own wallet rules" on public.smart_wallet_rules;
create policy "Users can view own wallet rules" on public.smart_wallet_rules
  for select
  using ((select public.current_user_id()) = user_id);

drop policy if exists "Users can view own transactions" on public.transactions;
create policy "Users can view own transactions" on public.transactions
  for select
  using ((select public.current_user_id()) = user_id);

drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions" on public.transactions
  for insert
  with check (
    (select public.current_user_id()) = user_id
    and exists (
      select 1
      from public.wallets
      where wallets.id = transactions.wallet_id
        and wallets.user_id = (select public.current_user_id())
        and coalesce(wallets.is_archived, false) = false
    )
    and (
      category_id is null
      or exists (
        select 1
        from public.categories
        where categories.id = transactions.category_id
          and categories.user_id = (select public.current_user_id())
      )
    )
  );

drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions" on public.transactions
  for update
  using ((select public.current_user_id()) = user_id)
  with check (
    (select public.current_user_id()) = user_id
    and exists (
      select 1
      from public.wallets
      where wallets.id = transactions.wallet_id
        and wallets.user_id = (select public.current_user_id())
        and coalesce(wallets.is_archived, false) = false
    )
    and (
      category_id is null
      or exists (
        select 1
        from public.categories
        where categories.id = transactions.category_id
          and categories.user_id = (select public.current_user_id())
      )
    )
  );

drop policy if exists "Users can view own wallets" on public.wallets;
create policy "Users can view own wallets" on public.wallets
  for select
  using ((select public.current_user_id()) = user_id);

drop policy if exists "Users can insert own wallets" on public.wallets;
create policy "Users can insert own wallets" on public.wallets
  for insert
  with check ((select public.current_user_id()) = user_id);

drop policy if exists "Users can update own wallets" on public.wallets;
create policy "Users can update own wallets" on public.wallets
  for update
  using ((select public.current_user_id()) = user_id);

drop policy if exists "Users can delete own wallets" on public.wallets;
create policy "Users can delete own wallets" on public.wallets
  for delete
  using ((select public.current_user_id()) = user_id);

-- Migration: 20260425134500_lock_down_public_function_grants.sql
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

grant execute on function public.adjust_wallet_balance(uuid, numeric) to authenticated, service_role;
grant execute on function public.contribute_to_goal(uuid, numeric, uuid) to authenticated, service_role;
grant execute on function public.create_goal_with_contribution(text, numeric, date, text, numeric, uuid) to authenticated, service_role;
grant execute on function public.create_wallet_with_opening_balance(text, numeric, text, text) to authenticated, service_role;
grant execute on function public.delete_goal_and_restore_funds(uuid, uuid) to authenticated, service_role;
grant execute on function public.delete_transaction_and_revert_balance(uuid) to authenticated, service_role;
grant execute on function public.delete_wallet_permanently_safe(uuid) to authenticated, service_role;
grant execute on function public.ensure_default_wallet() to authenticated, service_role;
grant execute on function public.get_analytics_snapshot(timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.get_name_conflicts() to authenticated, service_role;
grant execute on function public.learn_from_chat_input(text, uuid, uuid, text[], text[]) to authenticated, service_role;
grant execute on function public.record_transaction(uuid, uuid, text, numeric, text, text, text, timestamptz) to authenticated, service_role;
grant execute on function public.rename_goal(uuid, text) to authenticated, service_role;
grant execute on function public.rename_wallet(uuid, text) to authenticated, service_role;
grant execute on function public.restore_wallet_safely(uuid) to authenticated, service_role;
grant execute on function public.transfer_between_wallets(uuid, uuid, numeric, text, timestamptz) to authenticated, service_role;
grant execute on function public.withdraw_from_goal(uuid, numeric, uuid, text, timestamptz) to authenticated, service_role;

-- Migration: 20260425140500_restrict_authenticated_rpc_grants.sql
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from authenticated;

grant execute on function public.adjust_wallet_balance(uuid, numeric) to authenticated, service_role;
grant execute on function public.contribute_to_goal(uuid, numeric, uuid) to authenticated, service_role;
grant execute on function public.create_goal_with_contribution(text, numeric, date, text, numeric, uuid) to authenticated, service_role;
grant execute on function public.create_wallet_with_opening_balance(text, numeric, text, text) to authenticated, service_role;
grant execute on function public.delete_goal_and_restore_funds(uuid, uuid) to authenticated, service_role;
grant execute on function public.delete_transaction_and_revert_balance(uuid) to authenticated, service_role;
grant execute on function public.delete_wallet_permanently_safe(uuid) to authenticated, service_role;
grant execute on function public.ensure_default_wallet() to authenticated, service_role;
grant execute on function public.get_analytics_snapshot(timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.get_name_conflicts() to authenticated, service_role;
grant execute on function public.learn_from_chat_input(text, uuid, uuid, text[], text[]) to authenticated, service_role;
grant execute on function public.record_transaction(uuid, uuid, text, numeric, text, text, text, timestamptz) to authenticated, service_role;
grant execute on function public.rename_goal(uuid, text) to authenticated, service_role;
grant execute on function public.rename_wallet(uuid, text) to authenticated, service_role;
grant execute on function public.restore_wallet_safely(uuid) to authenticated, service_role;
grant execute on function public.transfer_between_wallets(uuid, uuid, numeric, text, timestamptz) to authenticated, service_role;
grant execute on function public.withdraw_from_goal(uuid, numeric, uuid, text, timestamptz) to authenticated, service_role;

-- Migration: 20260425161000_infer_uncategorized_analytics.sql
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
  v_user_id uuid := public.current_user_id();
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

-- Migration: 20260426104500_add_replace_transaction_entry.sql
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
  v_user_id uuid := public.current_user_id();
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

-- Migration: 20260427151000_lock_wallet_delete_to_rpc.sql
-- Wallet deletion must go through RPC functions so balance and ledger side effects stay controlled.
revoke delete on table public.wallets from anon, authenticated;

drop policy if exists "Users can delete own wallets" on public.wallets;

alter table public.chat_messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create or replace function public.handle_new_neon_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(new.name, ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_neon_user_created on neon_auth."user";
create trigger on_neon_user_created
  after insert on neon_auth."user"
  for each row execute function public.handle_new_neon_user();

grant usage on schema public to anonymous, authenticated;
grant select on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public
  grant select on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
