-- Make newly added RPC functions immediately visible to the Neon Data API.
notify pgrst, 'reload schema';
