do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'pending_finance_actions_expiry_window'
      and conrelid = 'public.pending_finance_actions'::regclass
  ) then
    alter table public.pending_finance_actions
      add constraint pending_finance_actions_expiry_window
      check (
        expires_at > created_at
        and expires_at <= created_at + interval '30 minutes'
      )
      not valid;
  end if;
end;
$$;

comment on constraint pending_finance_actions_expiry_window
  on public.pending_finance_actions
  is 'New assistant actions must expire shortly after staging; legacy rows remain readable until cleanup.';
