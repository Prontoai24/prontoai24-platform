-- Configurazione WhatsApp per tenant.
-- Il progetto usa clients come tabella tenant; client_id resta per compatibilità con 0005.
create extension if not exists pgcrypto;

alter table public.tenant_channel_settings
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists org_id uuid,
  add column if not exists provider text not null default 'meta',
  add column if not exists whatsapp_phone_number_id text,
  add column if not exists whatsapp_waba_id text,
  add column if not exists whatsapp_access_token text,
  add column if not exists is_active boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

update public.tenant_channel_settings
set org_id = client_id
where org_id is null;

update public.tenant_channel_settings
set id = gen_random_uuid()
where id is null;

alter table public.tenant_channel_settings
  alter column org_id set not null,
  alter column id set not null;

alter table public.tenant_channel_settings
  add constraint tenant_channel_settings_org_fk
  foreign key (org_id) references public.clients(id) on delete cascade;

create unique index if not exists tenant_channel_settings_org_provider_uidx
  on public.tenant_channel_settings(org_id, provider);
create index if not exists tenant_channel_settings_phone_idx
  on public.tenant_channel_settings(whatsapp_phone_number_id)
  where whatsapp_phone_number_id is not null;

-- Il token è cifrato applicativamente con AES-256-GCM prima di essere scritto.
-- La colonna contiene solo ciphertext:v1:iv:tag:data, mai il token Meta in chiaro.
comment on column public.tenant_channel_settings.whatsapp_access_token is
  'Ciphertext applicativo AES-256-GCM; non contiene mai il token Meta plaintext.';

alter table public.tenant_channel_settings enable row level security;
drop policy if exists "admin gestisce canali tenant" on public.tenant_channel_settings;
drop policy if exists "client legge canali tenant" on public.tenant_channel_settings;
drop policy if exists "tenant channel settings client read" on public.tenant_channel_settings;
drop policy if exists "tenant channel settings client write" on public.tenant_channel_settings;
drop policy if exists "tenant channel settings admin all" on public.tenant_channel_settings;

create policy "tenant channel settings client read"
  on public.tenant_channel_settings for select
  using (current_user_role() = 'client' and org_id in (select id from public.clients where profile_id = auth.uid()));
create policy "tenant channel settings client write"
  on public.tenant_channel_settings for all
  using (current_user_role() = 'client' and org_id in (select id from public.clients where profile_id = auth.uid()))
  with check (current_user_role() = 'client' and org_id in (select id from public.clients where profile_id = auth.uid()));
create policy "tenant channel settings admin all"
  on public.tenant_channel_settings for all
  using (
    current_user_role() = 'super_admin'
    or (current_user_role() = 'admin' and org_id in (select id from public.clients where managed_by_admin = auth.uid()))
  )
  with check (
    current_user_role() = 'super_admin'
    or (current_user_role() = 'admin' and org_id in (select id from public.clients where managed_by_admin = auth.uid()))
  );

-- Il ciphertext non è leggibile direttamente dai ruoli applicativi.
-- Le operazioni server-side usano service_role, che resta autorizzato.
revoke select (whatsapp_access_token) on public.tenant_channel_settings from anon, authenticated;
