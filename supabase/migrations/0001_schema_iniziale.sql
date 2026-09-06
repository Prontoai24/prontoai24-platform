-- ============================================================
-- ProntoAI24 — Schema iniziale del database
-- Gerarchia: super_admin -> admin -> client
-- ============================================================

-- Estensioni necessarie
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- ENUM: ruoli e stati
-- ------------------------------------------------------------
create type user_role as enum ('super_admin', 'admin', 'client');
create type account_status as enum ('in_setup', 'active', 'suspended', 'expired');
create type service_tier as enum ('base', 'evoluto', 'enterprise');
create type commitment_type as enum ('trimestrale', 'annuale');

-- ------------------------------------------------------------
-- PROFILES: estende auth.users di Supabase con ruolo e dati
-- ------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  full_name text,
  email text not null,
  must_change_password boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- CLIENTS: anagrafica dei clienti finali ProntoAI24
-- ------------------------------------------------------------
create table clients (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id) on delete set null, -- login del cliente (se già creato)
  managed_by_admin uuid not null references profiles(id),     -- quale admin l'ha creato/gestisce
  company_name text,
  vat_number text,
  fiscal_code text,
  contact_email text not null,
  contact_phone text,
  billing_address text,
  status account_status not null default 'in_setup',
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- SUBSCRIPTIONS: piano attivo di ogni cliente
-- ------------------------------------------------------------
create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  tier service_tier not null,
  minutes_package integer not null, -- 150, 300, 500, 1000, 2000, 4000, 7000, 10000
  commitment commitment_type not null,
  stripe_subscription_id text,
  stripe_price_id text,
  activation_paid boolean not null default false,
  whatsapp_addon boolean not null default false,
  chatbot_addon boolean not null default false,
  minutes_used_current_period numeric(10,2) not null default 0,
  current_period_start timestamptz,
  current_period_end timestamptz,
  status account_status not null default 'in_setup',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- PHONE_NUMBERS: numerazioni Telnyx assegnate ai clienti
-- ------------------------------------------------------------
create table phone_numbers (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  telnyx_number_id text,
  phone_number text not null,
  province text,
  vapi_phone_id text, -- collegamento all'assistente Vapi
  requirement_group_id text, -- Telnyx Requirement Group (compliance KYC)
  status text not null default 'pending', -- pending, active, suspended
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- CALL_LOGS: storico chiamate con trascrizione
-- ------------------------------------------------------------
create table call_logs (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  direction text not null, -- inbound, outbound
  from_number text,
  to_number text,
  duration_seconds integer not null default 0,
  recording_url text, -- Cloudflare R2
  transcript text,
  outcome text, -- answered, missed, transferred
  occurred_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- INVITES: inviti admin/cliente con password temporanea
-- ------------------------------------------------------------
create table invites (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  role user_role not null,
  invited_by uuid not null references profiles(id),
  token text not null unique,
  accepted boolean not null default false,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY — isolamento multi-tenant
-- ============================================================
alter table profiles enable row level security;
alter table clients enable row level security;
alter table subscriptions enable row level security;
alter table phone_numbers enable row level security;
alter table call_logs enable row level security;
alter table invites enable row level security;

-- Funzione helper: ruolo dell'utente corrente
create or replace function current_user_role() returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql stable security definer;

-- --- PROFILES ---
create policy "super_admin vede tutti i profili"
  on profiles for select
  using (current_user_role() = 'super_admin');

create policy "utente vede il proprio profilo"
  on profiles for select
  using (id = auth.uid());

create policy "admin vede i client che gestisce"
  on profiles for select
  using (
    current_user_role() = 'admin'
    and id in (select profile_id from clients where managed_by_admin = auth.uid())
  );

-- --- CLIENTS ---
create policy "super_admin vede tutti i clienti"
  on clients for all
  using (current_user_role() = 'super_admin');

create policy "admin vede/gestisce solo i propri clienti"
  on clients for all
  using (current_user_role() = 'admin' and managed_by_admin = auth.uid());

create policy "client vede solo se stesso"
  on clients for select
  using (current_user_role() = 'client' and profile_id = auth.uid());

-- --- SUBSCRIPTIONS ---
create policy "super_admin gestisce tutti gli abbonamenti"
  on subscriptions for all
  using (current_user_role() = 'super_admin');

create policy "admin gestisce abbonamenti dei propri clienti"
  on subscriptions for all
  using (
    current_user_role() = 'admin'
    and client_id in (select id from clients where managed_by_admin = auth.uid())
  );

create policy "client vede il proprio abbonamento"
  on subscriptions for select
  using (
    current_user_role() = 'client'
    and client_id in (select id from clients where profile_id = auth.uid())
  );

-- --- PHONE_NUMBERS ---
create policy "super_admin gestisce tutte le numerazioni"
  on phone_numbers for all
  using (current_user_role() = 'super_admin');

create policy "admin gestisce numerazioni dei propri clienti"
  on phone_numbers for all
  using (
    current_user_role() = 'admin'
    and client_id in (select id from clients where managed_by_admin = auth.uid())
  );

create policy "client vede la propria numerazione"
  on phone_numbers for select
  using (
    current_user_role() = 'client'
    and client_id in (select id from clients where profile_id = auth.uid())
  );

-- --- CALL_LOGS ---
create policy "super_admin vede tutte le chiamate"
  on call_logs for all
  using (current_user_role() = 'super_admin');

create policy "admin vede chiamate dei propri clienti"
  on call_logs for all
  using (
    current_user_role() = 'admin'
    and client_id in (select id from clients where managed_by_admin = auth.uid())
  );

create policy "client vede le proprie chiamate"
  on call_logs for select
  using (
    current_user_role() = 'client'
    and client_id in (select id from clients where profile_id = auth.uid())
  );

-- --- INVITES ---
create policy "super_admin gestisce tutti gli inviti"
  on invites for all
  using (current_user_role() = 'super_admin');

create policy "admin gestisce i propri inviti creati"
  on invites for all
  using (current_user_role() = 'admin' and invited_by = auth.uid());
