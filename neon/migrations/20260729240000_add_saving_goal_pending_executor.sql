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
  if v_row.action_type <> 'update_saving_goal' then
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
    'action_id', v_row.id,
    'action_type', v_row.action_type,
    'replayed', false,
    'data', jsonb_build_object(
      'goal_id', v_goal.id,
      'goal_name', v_goal.name,
      'target_amount', v_goal.target_amount,
      'current_amount', v_goal.current_amount,
      'deadline', v_goal.deadline,
      'status', v_goal.status
    )
  );

  update public.pending_finance_actions
  set status = 'confirmed',
      result = v_result,
      confirmed_at = now(),
      updated_at = now()
  where id = v_row.id;

  return v_result;
end;
$$;

revoke all on function public.execute_assistant_pending_finance_action(uuid, text)
  from public, anonymous, authenticated;
grant execute on function public.execute_assistant_pending_finance_action(uuid, text)
  to authenticated, service_role;
