alter table public.calls add column if not exists contact_id uuid references public.contacts(id) on delete set null;
alter table public.conversations add column if not exists contact_id uuid references public.contacts(id) on delete set null;
create index if not exists calls_contact_idx on public.calls(contact_id);
create index if not exists conversations_contact_idx on public.conversations(contact_id);
alter table public.contacts replica identity full;
alter table public.calls replica identity full;
alter table public.conversations replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.contacts;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.calls;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.conversations;
exception when duplicate_object then null;
end $$;
