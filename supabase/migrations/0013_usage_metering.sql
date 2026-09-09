-- Usage metering compatibile con lo schema attuale: clients rappresenta il tenant/org.
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.clients(id) on delete cascade,
  type text not null check (type in ('voice_minute', 'whatsapp_message', 'knowledge_source')),
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_events_org_type_created
  on public.usage_events(org_id, type, created_at);

alter table public.usage_events enable row level security;

drop policy if exists "Tenant isolation for usage_events" on public.usage_events;
create policy "Tenant isolation for usage_events"
  on public.usage_events for all
  using (
    current_user_role() = 'super_admin'
    or (current_user_role() = 'client' and org_id in (
      select id from public.clients where profile_id = auth.uid()
    ))
    or (current_user_role() = 'admin' and org_id in (
      select id from public.clients where managed_by_admin = auth.uid()
    ))
  )
  with check (
    current_user_role() = 'super_admin'
    or (current_user_role() = 'client' and org_id in (
      select id from public.clients where profile_id = auth.uid()
    ))
    or (current_user_role() = 'admin' and org_id in (
      select id from public.clients where managed_by_admin = auth.uid()
    ))
  );

alter table public.clients add column if not exists over_limit boolean not null default false;

comment on table public.usage_events is 'Eventi di consumo per tenant; org_id referenzia clients.id nello schema legacy.';
