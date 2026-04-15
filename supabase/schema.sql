-- Schema for GBC analytics dashboard
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/_/sql

create table if not exists public.orders (
  id              bigint primary key,
  number          text,
  status          text,
  status_group    text,
  order_type      text,
  order_method    text,
  site            text,
  customer_name   text,
  phone           text,
  email           text,
  city            text,
  utm_source      text,
  total_summ      numeric,
  items_count     integer,
  created_at      timestamptz,
  updated_at      timestamptz,
  raw             jsonb,
  synced_at       timestamptz default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx     on public.orders (status);

-- Enable RLS and allow public read (dashboard uses anon key)
alter table public.orders enable row level security;

drop policy if exists "orders_public_read" on public.orders;
create policy "orders_public_read"
  on public.orders
  for select
  to anon, authenticated
  using (true);
