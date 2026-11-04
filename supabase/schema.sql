-- Run once in the Supabase SQL editor (Database > SQL), then import data with supabase/data.js.

/* ---------- catalogue ---------- */

-- If older versions of these tables exist with a different layout, keep them as *_backup first.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'parts')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'parts' and column_name = 'category_key') then
    alter table public.parts rename to parts_backup;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'categories')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'categories' and column_name = 'sort_order') then
    alter table public.categories rename to categories_backup;
  end if;
end $$;

-- One row per category (Case, Plate, ...). The app reads these for the labels.
create table if not exists categories (
  key        text primary key,
  label      text not null,
  short      text not null,
  sort_order integer not null
);

-- One row per part option. data holds the full part object (name, price, grams, ...), the same shape the app uses.
create table if not exists parts (
  category_key text not null references categories(key) on delete cascade,
  id           text not null,
  sort_order   integer not null,
  data         jsonb not null,
  primary key (category_key, id)
);

create table if not exists prebuilts (
  id               text primary key,
  name             text not null,
  tagline          text,
  layout           text not null check (layout in ('60','75','100')),
  keys             integer not null,
  part_ids         jsonb not null,  -- { "case": "abs", "plate": "pcp", ... } ids from parts
  total_price_sgd  integer not null, -- snapshot from the import; re-import after price changes
  total_grams      integer not null,
  published        boolean not null default true,
  sort_order       integer not null default 0
);

/* ---------- customers, builds and orders ---------- */

-- A build a signed-in customer has saved to their profile.
create table if not exists saved_builds (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  layout      text not null check (layout in ('60','75','100')),
  part_ids    jsonb not null,
  answers     jsonb not null default '{}'::jsonb, -- quiz preferences and target Budget
  part_prices jsonb not null default '{}'::jsonb, -- historical prices for drift reporting
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Discount codes. Rows are created by the server (service role) only.
create table if not exists vouchers (
  code        text primary key,
  type        text not null check (type in ('pct','amt')),
  value       integer not null,
  expires_at  timestamptz not null,
  used_at     timestamptz
);

-- One row per checkout. Prices here are the server's numbers, not the browser's.
create table if not exists orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete set null,
  email             text not null,
  name              text not null,
  items             jsonb not null,   -- [{ name, layout, part_ids, price }]
  subtotal          integer not null,
  discount          integer not null default 0,
  total             integer not null,
  voucher_code      text,
  status            text not null default 'pending' check (status in ('pending','paid','failed')),
  hitpay_request_id text,
  created_at        timestamptz not null default now()
);

/* ---------- row level security ---------- */

alter table categories    enable row level security;
alter table parts         enable row level security;
alter table prebuilts     enable row level security;
alter table saved_builds  enable row level security;
alter table vouchers      enable row level security;
alter table orders        enable row level security;

-- Anyone can read the catalogue (read only; writes use the service role in the import script).
drop policy if exists "public read categories" on categories;
create policy "public read categories" on categories for select to anon, authenticated using (true);
drop policy if exists "public read parts" on parts;
create policy "public read parts" on parts for select to anon, authenticated using (true);
grant select on categories, parts to anon, authenticated;
create policy "public read prebuilts" on prebuilts for select using (published);

-- Signed-in customers manage their own saved builds and can see their own orders.
create policy "own saved builds" on saved_builds for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own orders" on orders for select
  using (auth.uid() = user_id);

-- Authenticated browser users still pass through the RLS ownership policy.
grant select, insert, update, delete on saved_builds to authenticated;

-- No public policies on vouchers or order writes: edge functions use the service role.

/* ---------- AI advisor rate limit ---------- */
-- One row per Biscuit question, used to limit each visitor (by IP) per hour. Written by edge functions only.
create table if not exists ai_requests (
  id          bigserial primary key,
  ip          text not null,
  created_at  timestamptz not null default now()
);
create index if not exists ai_requests_ip_time on ai_requests (ip, created_at);
alter table ai_requests enable row level security;
-- No public policies: only the advisor function (service role) reads or writes this table.
