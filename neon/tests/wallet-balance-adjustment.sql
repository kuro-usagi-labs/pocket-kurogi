-- Run as database owner. All fixtures and writes are rolled back.
begin;
do $$
declare
  u uuid; w uuid; k uuid := gen_random_uuid(); r jsonb; a jsonb; n integer;
begin
  select id into u from public.profiles order by id limit 1;
  if u is null then raise exception 'Test requires an existing profile'; end if;
  perform set_config('request.jwt.claim.sub', u::text, true);
  insert into public.wallets(user_id,name,wallet_type,initial_balance,current_balance)
    values(u,'QA balance '||k,'cash',50000,50000) returning id into w;
  r := public.set_wallet_balance_safely(w,50000,400000,k);
  if (r->>'current_balance')::numeric <> 400000 then raise exception 'Wrong target balance'; end if;
  r := public.set_wallet_balance_safely(w,50000,400000,k);
  if not (r->>'replayed')::boolean then raise exception 'Replay not detected'; end if;
  select count(*) into n from public.wallet_balance_adjustments where wallet_id=w;
  if n<>1 then raise exception 'Duplicate adjustment'; end if;
  select count(*) into n from public.transactions where wallet_id=w;
  if n<>0 then raise exception 'Adjustment polluted income/expense'; end if;
  begin
    perform public.set_wallet_balance_safely(w,50000,1,gen_random_uuid());
    raise exception 'ASSERT stale balance accepted';
  exception when others then
    if sqlerrm not like '%Saldo dompet sudah berubah%' then raise; end if;
  end;
  begin
    perform public.set_wallet_balance_safely(w,400000,-1,gen_random_uuid());
    raise exception 'ASSERT negative balance accepted';
  exception when others then
    if sqlerrm not like '%Saldo akhir tidak valid%' then raise; end if;
  end;
  begin
    perform public.set_wallet_balance_safely(w,50000,2,k);
    raise exception 'ASSERT reused key accepted';
  exception when others then
    if sqlerrm not like '%Idempotency key%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  begin
    perform public.set_wallet_balance_safely(w,400000,0,gen_random_uuid());
    raise exception 'ASSERT foreign wallet accepted';
  exception when others then
    if sqlerrm not like '%Dompet tidak ditemukan%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', u::text, true);
  a := public.create_pending_finance_action(k::text||'-chat','set_wallet_balance',
    jsonb_build_object('walletId',w,'walletName','QA','expectedBalance',400000,'targetBalance',0));
  r := public.execute_assistant_pending_finance_action((a->>'id')::uuid,a->>'payload_hash');
  if (r->'data'->>'current_balance')::numeric <> 0 then raise exception 'Zero final balance rejected'; end if;
  r := public.execute_assistant_pending_finance_action((a->>'id')::uuid,a->>'payload_hash');
  if not (r->>'replayed')::boolean then raise exception 'Chat replay not detected'; end if;
  if has_table_privilege('authenticated','public.wallet_balance_adjustments','INSERT') then raise exception 'Direct audit write granted'; end if;
  if has_function_privilege('anonymous','public.set_wallet_balance_safely(uuid,numeric,numeric,uuid)','EXECUTE') then raise exception 'Anonymous execute granted'; end if;
end;
$$;
rollback;
select 'PASS: balance, zero, replay, concurrency, ownership, audit, analytics isolation' as result;
