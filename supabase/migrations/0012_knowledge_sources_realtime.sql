-- ProntoAI24 — Realtime per lo stato delle fonti Knowledge Base
-- Applicare dopo 0008_knowledge_ingestion.sql.

alter table public.knowledge_sources replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.knowledge_sources;
exception
  when duplicate_object then null;
end;
$$;
