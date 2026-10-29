-- Run only in the NEW dedicated Supabase Free project for this simulator.
-- This script touches only public.blue_portfolio and never resets its data.
begin;
create table if not exists public.blue_portfolio (
  id text primary key check (id = 'main'),
  revision bigint not null default 0 check (revision >= 0),
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.blue_portfolio enable row level security;
revoke all on table public.blue_portfolio from anon, authenticated;
grant select, insert, update on table public.blue_portfolio to service_role;
-- No anonymous/authenticated policies: all reads and writes pass through the app.
-- Updates use WHERE revision = prior_revision and increment it atomically.
commit;
