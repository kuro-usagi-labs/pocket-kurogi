alter table public.pending_finance_actions
  drop constraint if exists pending_finance_actions_action_type_check;

alter table public.pending_finance_actions
  add constraint pending_finance_actions_action_type_check check (
    action_type in (
      'record_transactions',
      'transfer_money',
      'upsert_budget',
      'create_saving_goal',
      'update_saving_goal',
      'create_wallet',
      'rename_wallet',
      'archive_wallet',
      'restore_wallet',
      'deposit_goal',
      'withdraw_goal'
    )
  );

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
    'update_saving_goal',
    'create_wallet',
    'rename_wallet',
    'archive_wallet',
    'restore_wallet',
    'deposit_goal',
    'withdraw_goal'
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

create or replace function public.execute_assistant_pending_finance_action(
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
  v_goal public.goals%rowtype;
  v_target_amount numeric;
  v_result jsonb;
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

  if v_row.action_type not in (
    'create_wallet',
    'rename_wallet',
    'archive_wallet',
    'restore_wallet',
    'deposit_goal',
    'withdraw_goal',
    'update_saving_goal'
  ) then
    return public.execute_pending_finance_action(
      p_action_id,
      p_expected_payload_hash
    );
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

  if v_row.action_type = 'update_saving_goal' then
    v_target_amount := nullif(v_row.payload ->> 'amount', '')::numeric;
    if v_target_amount is null or v_target_amount <= 0 then
      raise exception 'Nominal target tabungan harus lebih besar dari nol.';
    end if;

    select *
      into v_goal
    from public.goals
    where id = nullif(v_row.payload ->> 'goalId', '')::uuid
      and user_id = v_user_id
      and coalesce(status, 'active') <> 'cancelled'
    for update;

    if not found then
      raise exception 'Target tabungan tidak ditemukan.';
    end if;

    update public.goals
    set target_amount = v_target_amount,
        deadline = case
          when v_row.payload ? 'deadline'
            and nullif(v_row.payload ->> 'deadline', '') is not null
          then (v_row.payload ->> 'deadline')::date
          else deadline
        end,
        status = case
          when coalesce(current_amount, 0) >= v_target_amount then 'completed'
          else 'active'
        end,
        updated_at = now()
    where id = v_goal.id
      and user_id = v_user_id
    returning * into v_goal;

    v_result := jsonb_build_object(
      'goal_id', v_goal.id,
      'goal_name', v_goal.name,
      'target_amount', v_goal.target_amount,
      'current_amount', v_goal.current_amount,
      'deadline', v_goal.deadline,
      'status', v_goal.status
    );
  elsif v_row.action_type = 'create_wallet' then
    v_result := public.create_wallet_with_opening_balance(
      trim(v_row.payload ->> 'walletName'),
      coalesce(nullif(v_row.payload ->> 'initialBalance', '')::numeric, 0),
      coalesce(nullif(v_row.payload ->> 'walletType', ''), 'cash'),
      null
    );
  elsif v_row.action_type = 'rename_wallet' then
    v_result := public.rename_wallet(
      (v_row.payload ->> 'walletId')::uuid,
      trim(v_row.payload ->> 'nextWalletName')
    );
  elsif v_row.action_type = 'archive_wallet' then
    v_result := public.archive_wallet_safely(
      (v_row.payload ->> 'walletId')::uuid
    );
  elsif v_row.action_type = 'restore_wallet' then
    v_result := public.restore_wallet_safely(
      (v_row.payload ->> 'walletId')::uuid
    );
  elsif v_row.action_type = 'deposit_goal' then
    v_result := public.contribute_to_goal(
      (v_row.payload ->> 'goalId')::uuid,
      (v_row.payload ->> 'amount')::numeric,
      (v_row.payload ->> 'sourceWalletId')::uuid
    );
  elsif v_row.action_type = 'withdraw_goal' then
    v_result := public.withdraw_from_goal(
      (v_row.payload ->> 'goalId')::uuid,
      (v_row.payload ->> 'amount')::numeric,
      (v_row.payload ->> 'destinationWalletId')::uuid,
      nullif(trim(coalesce(v_row.payload ->> 'description', '')), ''),
      coalesce(
        nullif(v_row.payload ->> 'occurredAt', '')::timestamptz,
        timezone('utc', now())
      )
    );
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

revoke all on function public.create_pending_finance_action(text, text, jsonb, timestamptz)
  from public, anonymous, authenticated;
revoke all on function public.execute_assistant_pending_finance_action(uuid, text)
  from public, anonymous, authenticated;

grant execute on function public.create_pending_finance_action(text, text, jsonb, timestamptz)
  to authenticated, service_role;
grant execute on function public.execute_assistant_pending_finance_action(uuid, text)
  to authenticated, service_role;
