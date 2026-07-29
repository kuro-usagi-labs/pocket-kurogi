create table if not exists public.assistant_dialogue_states (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_dialogue_states_state_object
    check (jsonb_typeof(state) = 'object')
);

create table if not exists public.assistant_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  memory_key text not null,
  memory_value jsonb not null,
  confidence numeric(4, 3) not null,
  source text not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_memories_key_check check (
    memory_key in (
      'preferred_wallet',
      'preferred_communication_style',
      'salary_date',
      'common_merchant_category',
      'financial_priority',
      'saving_goal_preference',
      'frequent_transaction_description'
    )
  ),
  constraint assistant_memories_confidence_check
    check (confidence >= 0 and confidence <= 1),
  constraint assistant_memories_source_check
    check (source in ('explicit', 'repeated', 'correction')),
  unique (user_id, memory_key)
);

create table if not exists public.pending_finance_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key text not null,
  action_type text not null,
  payload jsonb not null,
  payload_hash text not null,
  status text not null default 'pending',
  result jsonb,
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pending_finance_actions_action_type_check check (
    action_type in (
      'record_transactions',
      'transfer_money',
      'upsert_budget',
      'create_saving_goal',
      'update_saving_goal'
    )
  ),
  constraint pending_finance_actions_payload_object
    check (jsonb_typeof(payload) = 'object'),
  constraint pending_finance_actions_status_check check (
    status in ('pending', 'confirmed', 'cancelled', 'expired', 'failed')
  ),
  unique (user_id, idempotency_key)
);

create index if not exists idx_pending_finance_actions_user_status_expiry
  on public.pending_finance_actions (user_id, status, expires_at desc);

create index if not exists idx_assistant_memories_user_updated
  on public.assistant_memories (user_id, updated_at desc);

alter table public.assistant_dialogue_states enable row level security;
alter table public.assistant_memories enable row level security;
alter table public.pending_finance_actions enable row level security;

drop policy if exists "Users can view own assistant dialogue state"
  on public.assistant_dialogue_states;
create policy "Users can view own assistant dialogue state"
  on public.assistant_dialogue_states
  for select
  to authenticated
  using (public.current_user_id() = user_id);

drop policy if exists "Users can view own assistant memories"
  on public.assistant_memories;
create policy "Users can view own assistant memories"
  on public.assistant_memories
  for select
  to authenticated
  using (public.current_user_id() = user_id);

drop policy if exists "Users can view own pending finance actions"
  on public.pending_finance_actions;
create policy "Users can view own pending finance actions"
  on public.pending_finance_actions
  for select
  to authenticated
  using (public.current_user_id() = user_id);

revoke all on table public.assistant_dialogue_states
  from public, anonymous, authenticated, service_role;
revoke all on table public.assistant_memories
  from public, anonymous, authenticated, service_role;
revoke all on table public.pending_finance_actions
  from public, anonymous, authenticated, service_role;

grant select on table public.assistant_dialogue_states to authenticated;
grant select on table public.assistant_memories to authenticated;
grant select on table public.pending_finance_actions to authenticated;

create or replace function public.save_assistant_dialogue_state(
  p_state jsonb,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_row public.assistant_dialogue_states%rowtype;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'Dialogue state harus berupa object.';
  end if;
  if octet_length(p_state::text) > 65536 then
    raise exception 'Dialogue state terlalu besar.';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'Waktu kedaluwarsa dialogue state tidak valid.';
  end if;
  if p_expires_at > now() + interval '24 hours' then
    raise exception 'Dialogue state tidak boleh aktif lebih dari 24 jam.';
  end if;

  insert into public.assistant_dialogue_states (
    user_id,
    state,
    expires_at,
    updated_at
  )
  values (
    v_user_id,
    p_state,
    p_expires_at,
    now()
  )
  on conflict (user_id) do update
  set state = excluded.state,
      expires_at = excluded.expires_at,
      updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'user_id', v_row.user_id,
    'state', v_row.state,
    'expires_at', v_row.expires_at,
    'updated_at', v_row.updated_at
  );
end;
$$;

create or replace function public.remember_assistant_preference(
  p_memory_key text,
  p_memory_value jsonb,
  p_confidence numeric,
  p_source text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_key text := lower(trim(coalesce(p_memory_key, '')));
  v_source text := lower(trim(coalesce(p_source, '')));
  v_row public.assistant_memories%rowtype;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;
  if v_key not in (
    'preferred_wallet',
    'preferred_communication_style',
    'salary_date',
    'common_merchant_category',
    'financial_priority',
    'saving_goal_preference',
    'frequent_transaction_description'
  ) then
    raise exception 'Jenis memory tidak didukung.';
  end if;
  if p_memory_value is null or p_memory_value = 'null'::jsonb then
    raise exception 'Nilai memory wajib diisi.';
  end if;
  if octet_length(p_memory_value::text) > 4096 then
    raise exception 'Nilai memory terlalu besar.';
  end if;
  if p_confidence is null or p_confidence < 0 or p_confidence > 1 then
    raise exception 'Confidence memory harus berada di antara 0 dan 1.';
  end if;
  if v_source not in ('explicit', 'repeated', 'correction') then
    raise exception 'Sumber memory tidak valid.';
  end if;

  insert into public.assistant_memories (
    user_id,
    memory_key,
    memory_value,
    confidence,
    source,
    updated_at
  )
  values (
    v_user_id,
    v_key,
    p_memory_value,
    p_confidence,
    v_source,
    now()
  )
  on conflict (user_id, memory_key) do update
  set memory_value = excluded.memory_value,
      confidence = case
        when public.assistant_memories.memory_value = excluded.memory_value
          then least(1, greatest(public.assistant_memories.confidence, excluded.confidence) + 0.08)
        else excluded.confidence
      end,
      source = excluded.source,
      updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'memory_key', v_row.memory_key,
    'memory_value', v_row.memory_value,
    'confidence', v_row.confidence,
    'source', v_row.source,
    'updated_at', v_row.updated_at
  );
end;
$$;

create or replace function public.create_pending_finance_action(
  p_idempotency_key text,
  p_action_type text,
  p_payload jsonb,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_action_type text := lower(trim(coalesce(p_action_type, '')));
  v_payload_hash text;
  v_row public.pending_finance_actions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;
  if v_key = '' or length(v_key) > 200 then
    raise exception 'Idempotency key tidak valid.';
  end if;
  if v_action_type not in (
    'record_transactions',
    'transfer_money',
    'upsert_budget',
    'create_saving_goal',
    'update_saving_goal'
  ) then
    raise exception 'Jenis pending action tidak didukung.';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Payload pending action harus berupa object.';
  end if;
  if octet_length(p_payload::text) > 65536 then
    raise exception 'Payload pending action terlalu besar.';
  end if;

  v_payload_hash := md5(p_payload::text);

  insert into public.pending_finance_actions (
    user_id,
    idempotency_key,
    action_type,
    payload,
    payload_hash,
    expires_at
  )
  values (
    v_user_id,
    v_key,
    v_action_type,
    p_payload,
    v_payload_hash,
    coalesce(p_expires_at, now() + interval '15 minutes')
  )
  on conflict (user_id, idempotency_key) do nothing;

  select *
    into v_row
  from public.pending_finance_actions
  where user_id = v_user_id
    and idempotency_key = v_key;

  if v_row.payload_hash <> v_payload_hash
     or v_row.action_type <> v_action_type
     or v_row.payload <> p_payload then
    raise exception 'Idempotency key sudah dipakai untuk payload yang berbeda.';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'idempotency_key', v_row.idempotency_key,
    'action_type', v_row.action_type,
    'payload', v_row.payload,
    'payload_hash', v_row.payload_hash,
    'status', v_row.status,
    'result', v_row.result,
    'expires_at', v_row.expires_at,
    'created_at', v_row.created_at
  );
end;
$$;

create or replace function public.cancel_pending_finance_action(
  p_action_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_row public.pending_finance_actions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;

  select *
    into v_row
  from public.pending_finance_actions
  where id = p_action_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Pending action tidak ditemukan.';
  end if;
  if v_row.status = 'cancelled' then
    return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'replayed', true);
  end if;
  if v_row.status <> 'pending' then
    raise exception 'Pending action berstatus % dan tidak dapat dibatalkan.', v_row.status;
  end if;

  update public.pending_finance_actions
  set status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  where id = v_row.id;

  return jsonb_build_object('id', v_row.id, 'status', 'cancelled', 'replayed', false);
end;
$$;

create or replace function public.execute_pending_finance_action(
  p_action_id uuid,
  p_expected_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_row public.pending_finance_actions%rowtype;
  v_result jsonb;
  v_items jsonb;
  v_request_uuid uuid;
  v_category_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;

  select *
    into v_row
  from public.pending_finance_actions
  where id = p_action_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Pending action tidak ditemukan.';
  end if;
  if v_row.payload_hash <> trim(coalesce(p_expected_payload_hash, '')) then
    raise exception 'Payload pending action telah berubah. Muat ulang ringkasan sebelum konfirmasi.';
  end if;
  if v_row.status = 'confirmed' and v_row.result is not null then
    return jsonb_set(v_row.result, '{replayed}', 'true'::jsonb, true);
  end if;
  if v_row.status <> 'pending' then
    raise exception 'Pending action berstatus % dan tidak dapat dieksekusi.', v_row.status;
  end if;
  if v_row.expires_at <= now() then
    update public.pending_finance_actions
    set status = 'expired',
        updated_at = now()
    where id = v_row.id;
    raise exception 'Pending action sudah kedaluwarsa.';
  end if;

  if v_row.action_type = 'record_transactions' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'client_item_id', coalesce(nullif(item ->> 'clientItemId', ''), nullif(item ->> 'client_item_id', '')),
      'wallet_id', coalesce(nullif(item ->> 'walletId', ''), nullif(item ->> 'wallet_id', '')),
      'category_id', coalesce(nullif(item ->> 'categoryId', ''), nullif(item ->> 'category_id', '')),
      'transaction_type', coalesce(nullif(item ->> 'transactionType', ''), nullif(item ->> 'transaction_type', '')),
      'amount', item -> 'amount',
      'merchant', coalesce(nullif(item ->> 'description', ''), nullif(item ->> 'merchant', '')),
      'notes', item ->> 'notes',
      'occurred_at', coalesce(nullif(item ->> 'occurredAt', ''), nullif(item ->> 'occurred_at', ''))
    )), '[]'::jsonb)
      into v_items
    from jsonb_array_elements(v_row.payload -> 'items') as entries(item);

    v_request_uuid := (
      substr(md5(v_row.id::text), 1, 8) || '-' ||
      substr(md5(v_row.id::text), 9, 4) || '-' ||
      '4' || substr(md5(v_row.id::text), 14, 3) || '-' ||
      '8' || substr(md5(v_row.id::text), 18, 3) || '-' ||
      substr(md5(v_row.id::text), 21, 12)
    )::uuid;

    v_result := public.record_transactions_batch(v_request_uuid, v_items);
  elsif v_row.action_type = 'transfer_money' then
    v_result := public.transfer_between_wallets(
      (v_row.payload ->> 'sourceWalletId')::uuid,
      (v_row.payload ->> 'destinationWalletId')::uuid,
      (v_row.payload ->> 'amount')::numeric,
      nullif(trim(coalesce(v_row.payload ->> 'notes', '')), ''),
      nullif(v_row.payload ->> 'occurredAt', '')::timestamptz
    );
  elsif v_row.action_type = 'upsert_budget' then
    v_category_id := (v_row.payload ->> 'categoryId')::uuid;
    if not exists (
      select 1
      from public.categories
      where id = v_category_id
        and user_id = v_user_id
    ) then
      raise exception 'Kategori budget tidak ditemukan.';
    end if;

    insert into public.budgets (user_id, category_id, monthly_limit, updated_at)
    values (
      v_user_id,
      v_category_id,
      (v_row.payload ->> 'amount')::numeric,
      now()
    )
    on conflict (user_id, category_id) do update
    set monthly_limit = excluded.monthly_limit,
        updated_at = now();

    v_result := jsonb_build_object(
      'category_id', v_category_id,
      'monthly_limit', (v_row.payload ->> 'amount')::numeric
    );
  elsif v_row.action_type = 'create_saving_goal' then
    v_result := public.create_goal_with_contribution(
      trim(v_row.payload ->> 'description'),
      (v_row.payload ->> 'amount')::numeric,
      nullif(v_row.payload ->> 'deadline', '')::date,
      coalesce(nullif(v_row.payload ->> 'icon', ''), '🎯'),
      coalesce((v_row.payload ->> 'initialAmount')::numeric, 0),
      nullif(v_row.payload ->> 'sourceWalletId', '')::uuid
    );
  else
    raise exception 'Jenis pending action belum memiliki executor yang aman.';
  end if;

  v_result := jsonb_build_object(
    'action_id', v_row.id,
    'action_type', v_row.action_type,
    'replayed', false,
    'data', v_result
  );

  update public.pending_finance_actions
  set status = 'confirmed',
      result = v_result,
      confirmed_at = now(),
      updated_at = now()
  where id = v_row.id;

  return v_result;
exception
  when others then
    if v_row.id is not null then
      update public.pending_finance_actions
      set failure_reason = left(sqlerrm, 1000),
          updated_at = now()
      where id = v_row.id
        and status = 'pending';
    end if;
    raise;
end;
$$;

revoke all on function public.save_assistant_dialogue_state(jsonb, timestamptz)
  from public, anonymous, authenticated;
revoke all on function public.remember_assistant_preference(text, jsonb, numeric, text)
  from public, anonymous, authenticated;
revoke all on function public.create_pending_finance_action(text, text, jsonb, timestamptz)
  from public, anonymous, authenticated;
revoke all on function public.cancel_pending_finance_action(uuid)
  from public, anonymous, authenticated;
revoke all on function public.execute_pending_finance_action(uuid, text)
  from public, anonymous, authenticated;

grant execute on function public.save_assistant_dialogue_state(jsonb, timestamptz)
  to authenticated, service_role;
grant execute on function public.remember_assistant_preference(text, jsonb, numeric, text)
  to authenticated, service_role;
grant execute on function public.create_pending_finance_action(text, text, jsonb, timestamptz)
  to authenticated, service_role;
grant execute on function public.cancel_pending_finance_action(uuid)
  to authenticated, service_role;
grant execute on function public.execute_pending_finance_action(uuid, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
