-- Final-balance corrections are audit events, never income or expenses.
create table public.wallet_balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  wallet_name text not null,
  previous_balance numeric(15,2) not null,
  target_balance numeric(15,2) not null check (target_balance >= 0),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
alter table public.wallet_balance_adjustments enable row level security;
create policy wallet_adjustment_owner_read on public.wallet_balance_adjustments
  for select to authenticated using (user_id = public.current_user_id());
revoke all on public.wallet_balance_adjustments from public, anonymous, authenticated, service_role;
grant select on public.wallet_balance_adjustments to authenticated, service_role;

create function public.set_wallet_balance_safely(
  p_wallet_id uuid, p_expected_balance numeric, p_target_balance numeric, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  u uuid := public.current_user_id(); w public.wallets%rowtype;
  a public.wallet_balance_adjustments%rowtype;
begin
  if u is null then raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.'; end if;
  if p_idempotency_key is null then raise exception 'Idempotency key wajib diisi.'; end if;
  if p_target_balance is null or p_target_balance < 0 or p_target_balance > 9999999999999.99
     or p_target_balance::text in ('NaN','Infinity','-Infinity') or round(p_target_balance,2) <> p_target_balance then
    raise exception 'Saldo akhir tidak valid.';
  end if;
  if p_expected_balance is null or p_expected_balance::text in ('NaN','Infinity','-Infinity')
     or abs(p_expected_balance) > 9999999999999.99 or round(p_expected_balance,2) <> p_expected_balance then
    raise exception 'Saldo awal tidak valid.';
  end if;
  -- Same key is serialized even across different wallets.
  perform pg_advisory_xact_lock(hashtextextended(u::text || p_idempotency_key::text,0));
  select * into a from public.wallet_balance_adjustments where user_id=u and idempotency_key=p_idempotency_key;
  if found then
    if a.wallet_id<>p_wallet_id or a.previous_balance<>p_expected_balance or a.target_balance<>p_target_balance then
      raise exception 'Idempotency key sudah digunakan untuk penyesuaian berbeda.';
    end if;
    return jsonb_build_object('id',a.id,'wallet_id',a.wallet_id,'wallet_name',a.wallet_name,
      'previous_balance',a.previous_balance,'current_balance',a.target_balance,'replayed',true);
  end if;
  select * into w from public.wallets where id=p_wallet_id and user_id=u and not coalesce(is_archived,false) for update;
  if not found then raise exception 'Dompet tidak ditemukan atau sudah diarsipkan.'; end if;
  if w.current_balance is distinct from p_expected_balance then
    raise exception 'Saldo dompet sudah berubah. Muat ulang dan konfirmasi saldo terbaru.';
  end if;
  insert into public.wallet_balance_adjustments(user_id,wallet_id,wallet_name,previous_balance,target_balance,idempotency_key)
    values(u,w.id,w.name,w.current_balance,p_target_balance,p_idempotency_key) returning * into a;
  update public.wallets set current_balance=p_target_balance,updated_at=now() where id=w.id and user_id=u;
  return jsonb_build_object('id',a.id,'wallet_id',w.id,'wallet_name',w.name,
    'previous_balance',a.previous_balance,'current_balance',a.target_balance,'replayed',false);
end;
$$;
revoke all on function public.set_wallet_balance_safely(uuid,numeric,numeric,uuid) from public, anonymous, authenticated, service_role;
grant execute on function public.set_wallet_balance_safely(uuid,numeric,numeric,uuid) to authenticated, service_role;

-- Extend the existing allowlist without replacing staging/idempotency semantics.
alter table public.pending_finance_actions drop constraint pending_finance_actions_action_type_check;
alter table public.pending_finance_actions add constraint pending_finance_actions_action_type_check check (
  action_type in ('record_transactions','transfer_money','upsert_budget','create_saving_goal','update_saving_goal',
    'create_wallet','rename_wallet','archive_wallet','restore_wallet','deposit_goal','withdraw_goal','set_wallet_balance')
);
do $$
declare definition text; extended text;
begin
  definition := pg_get_functiondef('public.create_pending_finance_action(text,text,jsonb,timestamp with time zone)'::regprocedure);
  extended := replace(definition, '''withdraw_goal''', '''withdraw_goal'', ''set_wallet_balance''');
  if extended=definition then raise exception 'Pending-action allowlist changed; review migration before applying.'; end if;
  execute extended;
end;
$$;

alter function public.execute_assistant_pending_finance_action(uuid,text) rename to execute_assistant_pending_before_balance;
revoke all on function public.execute_assistant_pending_before_balance(uuid,text) from public, anonymous, authenticated, service_role;
create function public.execute_assistant_pending_finance_action(p_action_id uuid,p_expected_payload_hash text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=public.current_user_id(); a public.pending_finance_actions%rowtype; r jsonb;
begin
  if u is null then raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.'; end if;
  select * into a from public.pending_finance_actions where id=p_action_id and user_id=u for update;
  if not found then raise exception 'Pending action tidak ditemukan.'; end if;
  if a.action_type <> 'set_wallet_balance' then
    return public.execute_assistant_pending_before_balance(p_action_id,p_expected_payload_hash);
  end if;
  if a.payload_hash<>trim(coalesce(p_expected_payload_hash,'')) then raise exception 'Payload pending action telah berubah. Muat ulang ringkasan sebelum konfirmasi.'; end if;
  if a.status='confirmed' and a.result is not null then return jsonb_set(a.result,'{replayed}','true'::jsonb,true); end if;
  if a.status<>'pending' or a.expires_at<=now() then raise exception 'Konfirmasi tidak aktif atau sudah kedaluwarsa.'; end if;
  r := public.set_wallet_balance_safely((a.payload->>'walletId')::uuid,
    (a.payload->>'expectedBalance')::numeric,(a.payload->>'targetBalance')::numeric,a.id);
  r := jsonb_build_object('action_id',a.id,'action_type',a.action_type,'replayed',false,'data',r);
  update public.pending_finance_actions set status='confirmed',result=r,confirmed_at=now(),updated_at=now() where id=a.id;
  return r;
end;
$$;
revoke all on function public.execute_assistant_pending_finance_action(uuid,text) from public, anonymous, authenticated, service_role;
grant execute on function public.execute_assistant_pending_finance_action(uuid,text) to authenticated, service_role;
