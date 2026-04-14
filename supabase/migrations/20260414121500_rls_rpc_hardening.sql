alter policy "Users can insert own transactions" on public.transactions
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.wallets
      where wallets.id = wallet_id
        and wallets.user_id = auth.uid()
        and coalesce(wallets.is_archived, false) = false
    )
    and (
      category_id is null
      or exists (
        select 1
        from public.categories
        where categories.id = category_id
          and categories.user_id = auth.uid()
      )
    )
  );

alter policy "Users can update own transactions" on public.transactions
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.wallets
      where wallets.id = wallet_id
        and wallets.user_id = auth.uid()
        and coalesce(wallets.is_archived, false) = false
    )
    and (
      category_id is null
      or exists (
        select 1
        from public.categories
        where categories.id = category_id
          and categories.user_id = auth.uid()
      )
    )
  );

alter policy "Users can manage their own budgets" on public.budgets
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.categories
      where categories.id = category_id
        and categories.user_id = auth.uid()
    )
  );

alter policy "Users can insert own rules" on public.smart_category_rules
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.categories
      where categories.id = category_id
        and categories.user_id = auth.uid()
    )
  );

create policy "Users can update own rules" on public.smart_category_rules
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.categories
      where categories.id = category_id
        and categories.user_id = auth.uid()
    )
  );

create policy "Users can delete own rules" on public.smart_category_rules
  for delete
  using (auth.uid() = user_id);

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
