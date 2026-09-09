-- ProntoAI24 — WhatsApp and Web Chat omnichannel messages

alter table conversations
  add constraint conversations_channel_check
  check (channel in ('voice', 'whatsapp', 'webchat'));

create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references clients(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  provider text not null check (provider in ('whatsapp', 'webchat')),
  provider_message_id text,
  direction text not null default 'inbound' check (direction in ('inbound', 'outbound')),
  sender text,
  recipient text,
  body text not null default '',
  status text not null default 'received',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (provider, provider_message_id)
);

create index if not exists messages_org_occurred_idx on messages(org_id, occurred_at desc);
create index if not exists messages_conversation_occurred_idx on messages(conversation_id, occurred_at asc);

alter table messages enable row level security;

create policy "super_admin gestisce tutti i messaggi omnicanale"
  on messages for all using (current_user_role() = 'super_admin');
create policy "admin gestisce messaggi dei propri clienti"
  on messages for all using (
    current_user_role() = 'admin'
    and org_id in (select id from clients where managed_by_admin = auth.uid())
  );
create policy "client vede i propri messaggi"
  on messages for select using (
    current_user_role() = 'client'
    and org_id in (select id from clients where profile_id = auth.uid())
  );
