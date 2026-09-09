-- ProntoAI24 — knowledge ingestion, chunks and pgvector retrieval
create extension if not exists vector;

create table if not exists knowledge_sources (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references clients(id) on delete cascade,
  type text not null check (type in ('url', 'file')),
  source_value text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'error')),
  content_hash text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge_chunks (
  id uuid primary key default uuid_generate_v4(),
  source_id uuid not null references knowledge_sources(id) on delete cascade,
  org_id uuid not null references clients(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_id, chunk_index)
);

create index if not exists knowledge_sources_org_idx on knowledge_sources(org_id, updated_at desc);
create index if not exists knowledge_chunks_org_idx on knowledge_chunks(org_id);
create index if not exists knowledge_chunks_embedding_idx on knowledge_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create or replace function match_knowledge_chunks(
  query_embedding vector(1536),
  match_org_id uuid,
  match_threshold float default 0.72,
  match_count int default 8
)
returns table (id uuid, source_id uuid, content text, metadata jsonb, similarity float)
language sql stable
as $$
  select kc.id, kc.source_id, kc.content, kc.metadata,
         1 - (kc.embedding <=> query_embedding) as similarity
  from knowledge_chunks kc
  where kc.org_id = match_org_id
    and kc.embedding is not null
    and 1 - (kc.embedding <=> query_embedding) >= match_threshold
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;

alter table knowledge_sources enable row level security;
alter table knowledge_chunks enable row level security;

create policy "admin gestisce knowledge sources" on knowledge_sources for all using (
  current_user_role() in ('admin', 'super_admin')
  and (current_user_role() = 'super_admin' or org_id in (select id from clients where managed_by_admin = auth.uid()))
);
create policy "client vede proprie knowledge sources" on knowledge_sources for select using (
  current_user_role() = 'client' and org_id in (select id from clients where profile_id = auth.uid())
);
create policy "admin gestisce knowledge chunks" on knowledge_chunks for all using (
  current_user_role() in ('admin', 'super_admin')
  and (current_user_role() = 'super_admin' or org_id in (select id from clients where managed_by_admin = auth.uid()))
);
create policy "client vede propri knowledge chunks" on knowledge_chunks for select using (
  current_user_role() = 'client' and org_id in (select id from clients where profile_id = auth.uid())
);
