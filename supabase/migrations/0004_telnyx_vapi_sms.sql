-- ProntoAI24 — Telnyx compliance, Vapi mapping e SMS multi-tenant
-- Applicare dopo 0003_listino_dinamico.sql.

alter table public.phone_numbers
  add column if not exists telnyx_order_id text,
  add column if not exists vapi_assistant_id text,
  add column if not exists messaging_profile_id text,
  add column if not exists compliance_status text not null default 'pending',
  add column if not exists status_updated_at timestamptz not null default now();

alter table public.phone_numbers
  drop constraint if exists phone_numbers_compliance_status_check;

alter table public.phone_numbers
  add constraint phone_numbers_compliance_status_check
  check (compliance_status in ('pending', 'approved', 'rejected'));

alter table public.clients
  add column if not exists telnyx_requirement_group_id text;

create table if not exists public.sms_messages (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  from_number text not null,
  to_number text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'failed', 'received')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists phone_numbers_telnyx_order_idx on public.phone_numbers(telnyx_order_id);
create index if not exists phone_numbers_vapi_assistant_idx on public.phone_numbers(vapi_assistant_id);
create index if not exists sms_messages_client_created_idx on public.sms_messages(client_id, created_at desc);
create unique index if not exists sms_messages_provider_message_uidx on public.sms_messages(provider_message_id) where provider_message_id is not null;

alter table public.sms_messages enable row level security;

create policy "super admin gestisce tutti gli SMS"
  on public.sms_messages for all
  using (current_user_role() = 'super_admin');

create policy "admin gestisce SMS dei propri clienti"
  on public.sms_messages for all
  using (
    current_user_role() = 'admin'
    and client_id in (select id from public.clients where managed_by_admin = auth.uid())
  );

create policy "client vede i propri SMS"
  on public.sms_messages for select
  using (
    current_user_role() = 'client'
    and client_id in (select id from public.clients where profile_id = auth.uid())
  );
