-- The Data API authenticated role must be able to resolve auth.user_id().
-- USAGE reveals object names only; table access remains denied.
grant usage on schema auth to authenticated, service_role;
grant execute on function auth.user_id() to authenticated, service_role;
