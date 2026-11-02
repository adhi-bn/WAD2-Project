-- Saved-build contract upgrade: retain preferences and historical prices so a
-- reopening customer can see catalogue/price drift without silent replacement.

alter table public.saved_builds
  add column if not exists answers jsonb not null default '{}'::jsonb,
  add column if not exists part_prices jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_saved_build_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saved_builds_set_updated_at on public.saved_builds;
create trigger saved_builds_set_updated_at
before update on public.saved_builds
for each row execute function public.set_saved_build_updated_at();

alter table public.saved_builds enable row level security;

-- The explicit policies keep every client-side request tied to auth.uid().
-- They are split by operation to make the ownership contract easy to audit.
drop policy if exists "own saved builds" on public.saved_builds;
drop policy if exists "read own saved builds" on public.saved_builds;
drop policy if exists "insert own saved builds" on public.saved_builds;
drop policy if exists "update own saved builds" on public.saved_builds;
drop policy if exists "delete own saved builds" on public.saved_builds;

create policy "read own saved builds" on public.saved_builds
  for select using (auth.uid() = user_id);
create policy "insert own saved builds" on public.saved_builds
  for insert with check (auth.uid() = user_id);
create policy "update own saved builds" on public.saved_builds
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own saved builds" on public.saved_builds
  for delete using (auth.uid() = user_id);

-- Table privileges allow authenticated browser requests to reach the RLS
-- policies above; the grant does not bypass the auth.uid() ownership checks.
grant select, insert, update, delete on table public.saved_builds to authenticated;
