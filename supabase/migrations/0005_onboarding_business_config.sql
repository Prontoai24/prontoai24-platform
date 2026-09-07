-- ProntoAI24 — configurazione attività e onboarding multi-canale
-- Applicare dopo 0004_telnyx_vapi_sms.sql.

create table if not exists public.business_settings (
  client_id uuid primary key references public.clients(id) on delete cascade,
  website_url text,
  sms_sender_name text,
  description text,
  social_links jsonb not null default '{}'::jsonb,
  address text,
  city text,
  postal_code text,
  province text,
  country text not null default 'IT',
  regular_hours jsonb not null default '{}'::jsonb,
  special_hours jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.business_departments (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  description text,
  routing_target text,
  created_at timestamptz not null default now()
);

create table if not exists public.business_faqs (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  question text not null,
  answer text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_channel_settings (
  client_id uuid primary key references public.clients(id) on delete cascade,
  vapi_config jsonb not null default '{}'::jsonb,
  meta_config jsonb not null default '{}'::jsonb,
  whatsapp_config jsonb not null default '{}'::jsonb,
  chatbot_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.business_settings enable row level security;
alter table public.business_departments enable row level security;
alter table public.business_faqs enable row level security;
alter table public.tenant_channel_settings enable row level security;

create policy "admin gestisce business settings" on public.business_settings for all using (
  current_user_role() in ('admin', 'super_admin')
  and (current_user_role() = 'super_admin' or client_id in (select id from public.clients where managed_by_admin = auth.uid()))
);
create policy "client legge business settings" on public.business_settings for select using (
  current_user_role() = 'client' and client_id in (select id from public.clients where profile_id = auth.uid())
);
create policy "admin gestisce reparti" on public.business_departments for all using (
  current_user_role() in ('admin', 'super_admin')
  and (current_user_role() = 'super_admin' or client_id in (select id from public.clients where managed_by_admin = auth.uid()))
);
create policy "client legge reparti" on public.business_departments for select using (
  current_user_role() = 'client' and client_id in (select id from public.clients where profile_id = auth.uid())
);
create policy "admin gestisce FAQ" on public.business_faqs for all using (
  current_user_role() in ('admin', 'super_admin')
  and (current_user_role() = 'super_admin' or client_id in (select id from public.clients where managed_by_admin = auth.uid()))
);
create policy "client legge FAQ" on public.business_faqs for select using (
  current_user_role() = 'client' and client_id in (select id from public.clients where profile_id = auth.uid())
);
create policy "admin gestisce canali tenant" on public.tenant_channel_settings for all using (
  current_user_role() in ('admin', 'super_admin')
  and (current_user_role() = 'super_admin' or client_id in (select id from public.clients where managed_by_admin = auth.uid()))
);
create policy "client legge canali tenant" on public.tenant_channel_settings for select using (
  current_user_role() = 'client' and client_id in (select id from public.clients where profile_id = auth.uid())
);

create index if not exists business_departments_client_idx on public.business_departments(client_id);
create index if not exists business_faqs_client_idx on public.business_faqs(client_id);
