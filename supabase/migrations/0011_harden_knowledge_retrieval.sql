-- ProntoAI24 — hardening RPC RAG e isolamento tenant
-- Applicare dopo 0008_knowledge_ingestion.sql.

create unique index if not exists knowledge_sources_org_ready_hash_uidx
on knowledge_sources(org_id, content_hash)
where content_hash is not null and status = 'ready';

create or replace function match_knowledge_chunks(
  query_embedding vector(1536),
  match_org_id uuid,
  match_threshold float default 0.72,
  match_count int default 8
)
returns table (id uuid, source_id uuid, content text, metadata jsonb, similarity float)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(auth.jwt() ->> 'role', '');
  owns_org boolean := false;
begin
  if jwt_role <> 'service_role' then
    select exists (
      select 1
      from clients c
      where c.id = match_org_id
        and c.profile_id = auth.uid()
    ) into owns_org;

    if not owns_org then
      raise exception using
        errcode = '42501',
        message = 'Accesso RAG negato: org_id non associato all''utente autenticato';
    end if;
  end if;

  return query
  select kc.id,
         kc.source_id,
         kc.content,
         kc.metadata,
         1 - (kc.embedding <=> query_embedding) as similarity
  from knowledge_chunks kc
  where kc.org_id = match_org_id
    and kc.embedding is not null
    and 1 - (kc.embedding <=> query_embedding) >= match_threshold
  order by kc.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
end;
$$;

revoke execute on function match_knowledge_chunks(vector(1536), uuid, float, int)
from anon, authenticated;

grant execute on function match_knowledge_chunks(vector(1536), uuid, float, int)
to service_role;
