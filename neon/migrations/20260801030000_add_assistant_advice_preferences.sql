alter table public.assistant_memories
  drop constraint if exists assistant_memories_key_check;

alter table public.assistant_memories
  add constraint assistant_memories_key_check check (
    memory_key in (
      'preferred_wallet',
      'preferred_communication_style',
      'salary_date',
      'common_merchant_category',
      'financial_priority',
      'saving_goal_preference',
      'frequent_transaction_description',
      'advice_preferences'
    )
  );

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
    'frequent_transaction_description',
    'advice_preferences'
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
    user_id, memory_key, memory_value, confidence, source, updated_at
  ) values (
    v_user_id, v_key, p_memory_value, p_confidence, v_source, now()
  )
  on conflict (user_id, memory_key) do update
  set memory_value = excluded.memory_value,
      confidence = excluded.confidence,
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

create or replace function public.forget_assistant_memory(
  p_memory_key text default null,
  p_include_learning_rules boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_memory_count integer := 0;
  v_category_rule_count integer := 0;
  v_wallet_rule_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;
  if p_memory_key is not null and p_memory_key not in (
    'preferred_wallet',
    'preferred_communication_style',
    'salary_date',
    'common_merchant_category',
    'financial_priority',
    'saving_goal_preference',
    'frequent_transaction_description',
    'advice_preferences'
  ) then
    raise exception 'Jenis memory assistant tidak didukung.';
  end if;

  delete from public.assistant_memories
  where user_id = v_user_id
    and (p_memory_key is null or memory_key = p_memory_key);
  get diagnostics v_memory_count = row_count;

  if p_memory_key is null and p_include_learning_rules then
    delete from public.smart_category_rules where user_id = v_user_id;
    get diagnostics v_category_rule_count = row_count;
    delete from public.smart_wallet_rules where user_id = v_user_id;
    get diagnostics v_wallet_rule_count = row_count;
  end if;

  return jsonb_build_object(
    'memoriesDeleted', v_memory_count,
    'categoryRulesDeleted', v_category_rule_count,
    'walletRulesDeleted', v_wallet_rule_count
  );
end;
$$;

revoke all on function public.remember_assistant_preference(text, jsonb, numeric, text)
  from public, anonymous, authenticated, service_role;
grant execute on function public.remember_assistant_preference(text, jsonb, numeric, text)
  to authenticated, service_role;

revoke all on function public.forget_assistant_memory(text, boolean)
  from public, anonymous, authenticated, service_role;
grant execute on function public.forget_assistant_memory(text, boolean)
  to authenticated, service_role;
