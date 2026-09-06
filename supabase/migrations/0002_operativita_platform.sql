-- ProntoAI24 — Operatività piattaforma e moduli AI
-- Applicare dopo 0001_schema_iniziale.sql.

create table if not exists pricing_plans (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  tier service_tier not null,
  minutes_package integer not null check (minutes_package > 0),
  base_price_cents integer not null check (base_price_cents >= 0),
  whatsapp_addon_price_cents integer not null default 0 check (whatsapp_addon_price_cents >= 0),
  chatbot_addon_price_cents integer not null default 0 check (chatbot_addon_price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists provider_credentials (
  id uuid primary key default uuid_generate_v4(),
  provider text not null,
  label text not null,
  secret_reference text not null,
  active boolean not null default true,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, label)
);

create table if not exists tickets (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  created_by uuid not null references profiles(id),
  subject text not null,
  description text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  assigned_to uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge_documents (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  uploaded_by uuid not null references profiles(id),
  file_name text not null,
  storage_path text not null,
  mime_type text,
  status text not null default 'queued' check (status in ('queued', 'processing', 'ready', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chatbot_conversations (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  visitor_reference text,
  messages_count integer not null default 0,
  ai_resolutions integer not null default 0,
  human_escalations integer not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists whatsapp_messages (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  phone_number text,
  body text not null,
  status text not null default 'received',
  provider_message_id text,
  occurred_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  stripe_invoice_id text unique,
  amount_cents integer not null default 0,
  currency text not null default 'eur',
  status text not null default 'open',
  hosted_invoice_url text,
  invoice_pdf_url text,
  issued_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists clients_managed_by_admin_idx on clients(managed_by_admin);
create index if not exists tickets_client_status_idx on tickets(client_id, status);
create index if not exists call_logs_client_occurred_idx on call_logs(client_id, occurred_at desc);
create index if not exists whatsapp_messages_client_occurred_idx on whatsapp_messages(client_id, occurred_at desc);
create index if not exists audit_logs_actor_created_idx on audit_logs(actor_id, created_at desc);

alter table pricing_plans enable row level security;
alter table provider_credentials enable row level security;
alter table tickets enable row level security;
alter table knowledge_documents enable row level security;
alter table chatbot_conversations enable row level security;
alter table whatsapp_messages enable row level security;
alter table invoices enable row level security;
alter table audit_logs enable row level security;

create policy "piani attivi visibili agli utenti autenticati" on pricing_plans for select using (auth.uid() is not null and active = true);
create policy "super admin gestisce piani" on pricing_plans for all using (current_user_role() = 'super_admin');
create policy "super admin gestisce provider" on provider_credentials for all using (current_user_role() = 'super_admin');
create policy "admin vede ticket gestiti" on tickets for all using (
  current_user_role() in ('admin', 'super_admin')
  and (current_user_role() = 'super_admin' or client_id in (select id from clients where managed_by_admin = auth.uid()))
);
create policy "client gestisce propri ticket" on tickets for select using (
  current_user_role() = 'client' and client_id in (select id from clients where profile_id = auth.uid())
);
create policy "client crea propri ticket" on tickets for insert with check (
  current_user_role() = 'client' and client_id in (select id from clients where profile_id = auth.uid()) and created_by = auth.uid()
);
create policy "admin gestisce documenti" on knowledge_documents for all using (
  current_user_role() in ('admin', 'super_admin')
  and (current_user_role() = 'super_admin' or client_id in (select id from clients where managed_by_admin = auth.uid()))
);
create policy "client vede propri documenti" on knowledge_documents for select using (
  current_user_role() = 'client' and client_id in (select id from clients where profile_id = auth.uid())
);
create policy "client vede proprie conversazioni" on chatbot_conversations for select using (
  current_user_role() = 'client' and client_id in (select id from clients where profile_id = auth.uid())
);
create policy "admin vede conversazioni" on chatbot_conversations for select using (
  current_user_role() in ('admin', 'super_admin')
  and (current_user_role() = 'super_admin' or client_id in (select id from clients where managed_by_admin = auth.uid()))
);
create policy "client vede whatsapp propri" on whatsapp_messages for select using (
  current_user_role() = 'client' and client_id in (select id from clients where profile_id = auth.uid())
);
create policy "admin vede whatsapp" on whatsapp_messages for select using (
  current_user_role() in ('admin', 'super_admin')
  and (current_user_role() = 'super_admin' or client_id in (select id from clients where managed_by_admin = auth.uid()))
);
create policy "client vede proprie fatture" on invoices for select using (
  current_user_role() = 'client' and client_id in (select id from clients where profile_id = auth.uid())
);
create policy "admin vede fatture" on invoices for select using (
  current_user_role() in ('admin', 'super_admin')
  and (current_user_role() = 'super_admin' or client_id in (select id from clients where managed_by_admin = auth.uid()))
);
create policy "super admin vede audit" on audit_logs for select using (current_user_role() = 'super_admin');
create policy "utenti autenticati scrivono audit" on audit_logs for insert with check (actor_id = auth.uid());
