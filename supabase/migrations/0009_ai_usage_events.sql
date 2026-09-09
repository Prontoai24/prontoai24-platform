-- ProntoAI24 — AI usage analytics
create table if not exists ai_usage_events (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references clients(id) on delete cascade,
  channel text not null check (channel in ('voice', 'whatsapp', 'webchat', 'chat', 'other')),
  provider text not null default 'openai',
  model text,
  request_id text not null unique,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  latency_ms integer not null default 0,
  cost_usd numeric(12,8) not null default 0,
  status text not null default 'success' check (status in ('success', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_org_created_idx on ai_usage_events(org_id, created_at desc);
create index if not exists ai_usage_events_channel_created_idx on ai_usage_events(channel, created_at desc);

alter table ai_usage_events enable row level security;
create policy "super admin vede usage AI" on ai_usage_events for all using (current_user_role() = 'super_admin');
create policy "admin vede usage propri clienti" on ai_usage_events for select using (
  current_user_role() = 'admin'
  and org_id in (select id from clients where managed_by_admin = auth.uid())
);
create policy "client vede usage proprio" on ai_usage_events for select using (
  current_user_role() = 'client'
  and org_id in (select id from clients where profile_id = auth.uid())
);
