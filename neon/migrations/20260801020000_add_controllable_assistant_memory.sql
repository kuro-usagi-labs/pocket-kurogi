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
    'frequent_transaction_description'
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

revoke all on function public.forget_assistant_memory(text, boolean)
  from public, anonymous, authenticated, service_role;
grant execute on function public.forget_assistant_memory(text, boolean)
  to authenticated, service_role;
