alter function public.normalize_entity_name(text) set search_path = public;

drop policy if exists "Users can manage their own budgets" on public.budgets;
create policy "Users can manage their own budgets" on public.budgets
  for all
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.categories
      where categories.id = budgets.category_id
        and categories.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can view own categories" on public.categories;
create policy "Users can view own categories" on public.categories
  for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own categories" on public.categories;
create policy "Users can insert own categories" on public.categories
  for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own categories" on public.categories;
create policy "Users can update own categories" on public.categories
  for update
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own categories" on public.categories;
create policy "Users can delete own categories" on public.categories
  for delete
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own messages" on public.chat_messages;
create policy "Users can view their own messages" on public.chat_messages
  for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own messages" on public.chat_messages;
create policy "Users can insert their own messages" on public.chat_messages
  for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own messages" on public.chat_messages;
create policy "Users can delete their own messages" on public.chat_messages
  for delete
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own goals" on public.goals;
create policy "Users can view own goals" on public.goals
  for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own goals" on public.goals;
create policy "Users can insert own goals" on public.goals
  for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own goals" on public.goals;
create policy "Users can update own goals" on public.goals
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select
  using ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update
  using ((select auth.uid()) = id);

drop policy if exists "Users can view own rules" on public.smart_category_rules;
create policy "Users can view own rules" on public.smart_category_rules
  for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own rules" on public.smart_category_rules;
create policy "Users can insert own rules" on public.smart_category_rules
  for insert
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.categories
      where categories.id = smart_category_rules.category_id
        and categories.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can update own rules" on public.smart_category_rules;
create policy "Users can update own rules" on public.smart_category_rules
  for update
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.categories
      where categories.id = smart_category_rules.category_id
        and categories.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can delete own rules" on public.smart_category_rules;
create policy "Users can delete own rules" on public.smart_category_rules
  for delete
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own wallet rules" on public.smart_wallet_rules;
create policy "Users can view own wallet rules" on public.smart_wallet_rules
  for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own transactions" on public.transactions;
create policy "Users can view own transactions" on public.transactions
  for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions" on public.transactions
  for insert
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.wallets
      where wallets.id = transactions.wallet_id
        and wallets.user_id = (select auth.uid())
        and coalesce(wallets.is_archived, false) = false
    )
    and (
      category_id is null
      or exists (
        select 1
        from public.categories
        where categories.id = transactions.category_id
          and categories.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions" on public.transactions
  for update
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.wallets
      where wallets.id = transactions.wallet_id
        and wallets.user_id = (select auth.uid())
        and coalesce(wallets.is_archived, false) = false
    )
    and (
      category_id is null
      or exists (
        select 1
        from public.categories
        where categories.id = transactions.category_id
          and categories.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Users can view own wallets" on public.wallets;
create policy "Users can view own wallets" on public.wallets
  for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own wallets" on public.wallets;
create policy "Users can insert own wallets" on public.wallets
  for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own wallets" on public.wallets;
create policy "Users can update own wallets" on public.wallets
  for update
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own wallets" on public.wallets;
create policy "Users can delete own wallets" on public.wallets
  for delete
  using ((select auth.uid()) = user_id);
