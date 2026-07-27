create table if not exists public.chat_attachments (
  id uuid primary key,
  user_id uuid not null references neon_auth."user"(id) on delete cascade,
  content_type text not null,
  data_base64 text not null,
  created_at timestamptz not null default now(),
  constraint chat_attachments_content_type_check
    check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint chat_attachments_size_check
    check (length(data_base64) <= 5600000)
);

alter table public.chat_attachments enable row level security;

drop policy if exists "Users can read own chat attachments" on public.chat_attachments;
create policy "Users can read own chat attachments"
  on public.chat_attachments
  for select
  to authenticated
  using (public.current_user_id() = user_id);

drop policy if exists "Users can insert own chat attachments" on public.chat_attachments;
create policy "Users can insert own chat attachments"
  on public.chat_attachments
  for insert
  to authenticated
  with check (public.current_user_id() = user_id);

drop policy if exists "Users can delete own chat attachments" on public.chat_attachments;
create policy "Users can delete own chat attachments"
  on public.chat_attachments
  for delete
  to authenticated
  using (public.current_user_id() = user_id);

grant select, insert, delete on public.chat_attachments to authenticated;
