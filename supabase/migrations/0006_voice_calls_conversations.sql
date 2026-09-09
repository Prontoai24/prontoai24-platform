-- ProntoAI24 — Voice calls and conversations
-- org_id maps to the tenant row in clients.id.

create table if not exists calls (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references clients(id) on delete cascade,
  provider_call_id text,
  conversation_id text,
  recording_url text,
  duration integer not null default 0,
  started_at timestamptz,
  ended_at timestamptz,
  direction text,
  from_number text,
  to_number text,
  status text,
  ended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_call_id)
);

create table if not exists conversations (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references clients(id) on delete cascade,
  conversation_id text not null,
  channel text not null default 'voice',
  transcript text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, conversation_id)
);

create index if not exists calls_org_started_idx on calls(org_id, started_at desc);
create index if not exists calls_conversation_idx on calls(conversation_id);
create index if not exists conversations_org_updated_idx on conversations(org_id, updated_at desc);

alter table calls enable row level security;
alter table conversations enable row level security;

create policy "super_admin gestisce tutte le chiamate voice"
  on calls for all using (current_user_role() = 'super_admin');
create policy "admin gestisce chiamate voice dei propri clienti"
  on calls for all using (
    current_user_role() = 'admin'
    and org_id in (select id from clients where managed_by_admin = auth.uid())
  );
create policy "client vede le proprie chiamate voice"
  on calls for select using (
    current_user_role() = 'client'
    and org_id in (select id from clients where profile_id = auth.uid())
  );

create policy "super_admin gestisce tutte le conversazioni voice"
  on conversations for all using (current_user_role() = 'super_admin');
create policy "admin gestisce conversazioni voice dei propri clienti"
  on conversations for all using (
    current_user_role() = 'admin'
    and org_id in (select id from clients where managed_by_admin = auth.uid())
  );
create policy "client vede le proprie conversazioni voice"
  on conversations for select using (
    current_user_role() = 'client'
    and org_id in (select id from clients where profile_id = auth.uid())
  );
