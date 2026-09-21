revoke delete on table public.profiles from public, anon, authenticated;

drop policy if exists "Profiles - Owner Delete" on public.profiles;
