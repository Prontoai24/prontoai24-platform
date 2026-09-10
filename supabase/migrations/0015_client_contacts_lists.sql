create table if not exists public.contact_lists (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, name)
);

create table if not exists public.contacts (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  list_id uuid references public.contact_lists(id) on delete set null,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  messenger text,
  instagram text,
  notes text,
  stage text not null default 'Nuovo' check (stage in ('Nuovo', 'Da contattare', 'In corso', 'Cliente')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_client_idx on public.contacts(client_id, updated_at desc);
create index if not exists contact_lists_client_idx on public.contact_lists(client_id, name);
alter table public.contact_lists enable row level security;
alter table public.contacts enable row level security;

drop policy if exists "client manages own contact lists" on public.contact_lists;
create policy "client manages own contact lists" on public.contact_lists for all using (
  client_id in (select id from public.clients where profile_id = auth.uid())
  or current_user_role() in ('admin', 'super_admin')
) with check (
  client_id in (select id from public.clients where profile_id = auth.uid())
  or current_user_role() in ('admin', 'super_admin')
);

drop policy if exists "client manages own contacts" on public.contacts;
create policy "client manages own contacts" on public.contacts for all using (
  client_id in (select id from public.clients where profile_id = auth.uid())
  or current_user_role() in ('admin', 'super_admin')
) with check (
  client_id in (select id from public.clients where profile_id = auth.uid())
  or current_user_role() in ('admin', 'super_admin')
);

insert into public.contact_lists (client_id, name, description)
select c.id, 'Contatti demo', 'Lista iniziale per il collaudo ProntoAI24'
from public.clients c
where c.contact_email = 'demo.cliente@prontoai24.it'
on conflict (client_id, name) do nothing;

insert into public.contacts (client_id, list_id, first_name, last_name, email, phone, stage, notes)
select c.id, l.id, 'Maria', 'Rossi', 'maria.rossi@example.com', '+393331234567', 'Da contattare', 'Contatto demo per test chiamate vocali.'
from public.clients c join public.contact_lists l on l.client_id = c.id and l.name = 'Contatti demo'
where c.contact_email = 'demo.cliente@prontoai24.it'
  and not exists (select 1 from public.contacts x where x.client_id = c.id and x.email = 'maria.rossi@example.com');
