-- Wallet deletion must go through RPC functions so balance and ledger side effects stay controlled.
revoke delete on table public.wallets from anon, authenticated;

drop policy if exists "Users can delete own wallets" on public.wallets;
