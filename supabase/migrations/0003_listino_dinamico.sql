-- ProntoAI24 — Listino dinamico per piano, minuti e ciclo di fatturazione
create table if not exists pricing_catalog (
  id uuid primary key default uuid_generate_v4(),
  plan_type service_tier not null,
  included_minutes integer not null check (included_minutes in (150,300,500,1000,2000,4000,7000,10000)),
  billing_cycle commitment_type not null,
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_type, included_minutes, billing_cycle)
);

alter table subscriptions add column if not exists monthly_price_cents integer;
create index if not exists pricing_catalog_lookup_idx on pricing_catalog(plan_type, included_minutes, billing_cycle) where active = true;
alter table pricing_catalog enable row level security;
create policy "listino attivo visibile agli autenticati" on pricing_catalog for select using (auth.uid() is not null and active = true);
create policy "super admin gestisce listino dinamico" on pricing_catalog for all using (current_user_role() = 'super_admin');
