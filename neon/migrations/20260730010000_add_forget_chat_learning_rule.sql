create or replace function public.forget_chat_learning_rule(
  p_keyword text,
  p_rule_type text default 'all'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_keyword text := lower(regexp_replace(trim(coalesce(p_keyword, '')), '\s+', ' ', 'g'));
  v_rule_type text := lower(trim(coalesce(p_rule_type, 'all')));
  v_category_deleted integer := 0;
  v_wallet_deleted integer := 0;
begin
  if v_user_id is null then
    raise exception 'Sesi Anda sudah berakhir. Silakan login lagi.';
  end if;
  if length(v_keyword) < 2 or length(v_keyword) > 48 then
    raise exception 'Kata pembelajaran tidak valid.';
  end if;
  if v_rule_type not in ('category', 'wallet', 'all') then
    raise exception 'Jenis aturan pembelajaran tidak valid.';
  end if;

  if v_rule_type in ('category', 'all') then
    delete from public.smart_category_rules
    where user_id = v_user_id
      and keyword = v_keyword;
    get diagnostics v_category_deleted = row_count;
  end if;

  if v_rule_type in ('wallet', 'all') then
    delete from public.smart_wallet_rules
    where user_id = v_user_id
      and keyword = v_keyword;
    get diagnostics v_wallet_deleted = row_count;
  end if;

  return jsonb_build_object(
    'keyword', v_keyword,
    'categoryRulesDeleted', v_category_deleted,
    'walletRulesDeleted', v_wallet_deleted
  );
end;
$$;

revoke all on function public.forget_chat_learning_rule(text, text)
  from public, anonymous;
grant execute on function public.forget_chat_learning_rule(text, text)
  to authenticated, service_role;
