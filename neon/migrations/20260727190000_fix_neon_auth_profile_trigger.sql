-- Keep Neon Auth user creation in sync with the current profiles schema.
create or replace function public.handle_new_neon_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.name, ''), split_part(new.email, '@', 1)))
  on conflict (id) do update
    set display_name = coalesce(public.profiles.display_name, excluded.display_name),
        updated_at = now();

  return new;
end;
$$;

revoke all on function public.handle_new_neon_user() from public;
