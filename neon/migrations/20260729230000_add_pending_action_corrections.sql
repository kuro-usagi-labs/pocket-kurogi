create or replace function public.correct_pending_finance_action(
  p_action_id uuid,
  p_expected_payload_hash text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_row public.pending_finance_actions%rowtype;
  v_payload_hash text;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Payload koreksi harus berupa object.';
  end if;
  if octet_length(p_payload::text) > 65536 then
    raise exception 'Payload koreksi terlalu besar.';
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
  if v_row.status <> 'pending' then
    raise exception 'Hanya pending action aktif yang dapat dikoreksi.';
  end if;
  if v_row.expires_at <= now() then
    update public.pending_finance_actions
    set status = 'expired',
        updated_at = now()
    where id = v_row.id;
    raise exception 'Pending action sudah kedaluwarsa.';
  end if;
  if v_row.payload_hash <> trim(coalesce(p_expected_payload_hash, '')) then
    raise exception 'Payload pending action telah berubah. Muat ulang sebelum mengoreksi.';
  end if;

  v_payload_hash := md5(p_payload::text);

  update public.pending_finance_actions
  set payload = p_payload,
      payload_hash = v_payload_hash,
      failure_reason = null,
      updated_at = now()
  where id = v_row.id
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'idempotency_key', v_row.idempotency_key,
    'action_type', v_row.action_type,
    'payload', v_row.payload,
    'payload_hash', v_row.payload_hash,
    'status', v_row.status,
    'result', v_row.result,
    'expires_at', v_row.expires_at,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
end;
$$;

revoke all on function public.correct_pending_finance_action(uuid, text, jsonb)
  from public, anonymous, authenticated;
grant execute on function public.correct_pending_finance_action(uuid, text, jsonb)
  to authenticated, service_role;

notify pgrst, 'reload schema';
