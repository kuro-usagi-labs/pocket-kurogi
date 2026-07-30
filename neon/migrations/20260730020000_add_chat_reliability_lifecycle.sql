-- Server-mediated chat writes create an immutable ordering record that can be
-- correlated with privacy-safe request telemetry. Event rows disappear with
-- their message so a user reset still removes all personal application data.
create table if not exists public.chat_conversation_events (
  sequence_id bigint generated always as identity primary key,
  user_id uuid not null references neon_auth."user"(id) on delete cascade,
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  request_id uuid not null default gen_random_uuid(),
  event_type text not null check (event_type = 'message_created'),
  created_at timestamptz not null default now(),
  unique (message_id, event_type)
);

create index if not exists idx_chat_conversation_events_user_sequence
  on public.chat_conversation_events (user_id, sequence_id desc);

alter table public.chat_conversation_events enable row level security;
revoke all on table public.chat_conversation_events from public, anonymous, authenticated, service_role;

drop policy if exists "Users can view own chat conversation events" on public.chat_conversation_events;
create policy "Users can view own chat conversation events"
  on public.chat_conversation_events
  for select
  to authenticated
  using ((select public.current_user_id()) = user_id);

alter table public.pending_finance_actions
  add column if not exists superseded_at timestamptz;

alter table public.pending_finance_actions
  drop constraint if exists pending_finance_actions_status_check;
alter table public.pending_finance_actions
  add constraint pending_finance_actions_status_check
  check (status in ('pending', 'confirmed', 'cancelled', 'superseded', 'expired', 'failed'));

create or replace function public.supersede_pending_finance_actions()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;

  update public.pending_finance_actions
  set status = 'superseded',
      superseded_at = now(),
      updated_at = now()
  where user_id = v_user_id
    and status = 'pending';
  get diagnostics v_count = row_count;

  delete from public.assistant_dialogue_states
  where user_id = v_user_id;

  return jsonb_build_object('status', 'superseded', 'count', v_count);
end;
$$;

revoke all on function public.supersede_pending_finance_actions() from public, anonymous, authenticated;
grant execute on function public.supersede_pending_finance_actions() to authenticated, service_role;

notify pgrst, 'reload schema';
