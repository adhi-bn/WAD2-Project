-- Run once in the Supabase SQL editor (Database > SQL), then import data with supabase/data.js.

/* ---------- catalogue ---------- */

create table if not exists parts (
  id           text primary key,
  category     text not null check (category in ('case','plate','pcb','switches','keycaps','stabs','foam','cable')),
  name         text not null,
  price_sgd    integer,            -- flat base price (60% layout); null for per-switch / per-stabiliser items
  unit_price   numeric,            -- per-switch or per-stabiliser price; null otherwise
  grams_base   integer,
  attributes   jsonb not null default '{}'::jsonb
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
  created_at  timestamptz not null default now()
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

alter table parts         enable row level security;
alter table prebuilts     enable row level security;
alter table saved_builds  enable row level security;
alter table vouchers      enable row level security;
alter table orders        enable row level security;

-- Anyone can read the catalogue.
create policy "public read parts"     on parts     for select using (true);
create policy "public read prebuilts" on prebuilts for select using (published);

-- Signed-in customers manage their own saved builds and can see their own orders.
create policy "own saved builds" on saved_builds for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own orders" on orders for select
  using (auth.uid() = user_id);

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
