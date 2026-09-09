# Knowledge Base e RAG ProntoAI24

## Scelta MVP

Per l’MVP viene usato **Supabase Postgres con pgvector**. È la scelta più semplice perché database, RLS, tenant isolation e vettori restano nello stesso sistema; non introduce un servizio vettoriale separato né un secondo set di credenziali. Il costo operativo è incluso nell’istanza Supabase già necessaria.

Un servizio esterno come Pinecone, Qdrant Cloud o Weaviate diventa interessante quando il volume cresce, sono necessari indici altamente specializzati o il carico di ricerca deve essere separato dal database transazionale. Per l’attuale fase iniziale aggiungerebbe complessità e costo senza un beneficio necessario.

## Flusso di ingestione

1. Il cliente carica un file oppure inserisce un URL.
2. I file vengono salvati nel bucket privato Supabase Storage `knowledge-base`, con path prefissato dall’`org_id`. L’architettura può sostituire l’adapter Storage con Cloudflare R2 senza cambiare lo schema.
3. Per URL viene usato Firecrawl `/v2/scrape` quando `FIRECRAWL_API_KEY` è configurata. Senza chiave, il sistema usa un fallback HTTP diretto per pagine statiche.
4. Per PDF e documenti viene usato Unstructured Partition API quando `UNSTRUCTURED_API_KEY` è configurata. TXT, Markdown e CSV sono letti localmente; PDF usa `pdf-parse` come fallback. DOC/DOCX richiedono Unstructured.
5. Il testo viene normalizzato e diviso in chunk da circa 1.200 caratteri con overlap di 180 caratteri.
6. Gli embedding vengono creati con OpenAI `text-embedding-3-small` tramite `OPENAI_API_KEY`.
7. I chunk e i vettori vengono salvati in `knowledge_chunks`; lo stato della fonte passa a `ready` solo se gli embedding sono disponibili. Se manca la chiave OpenAI, il testo viene conservato ma la fonte passa a `error` con messaggio esplicito.
8. `content_hash` permette di identificare il contenuto e preparare deduplicazione/re-ingestion future.

## API e UI

- `GET /api/client/knowledge/sources`: elenco fonti del tenant autenticato.
- `POST /api/client/knowledge/sources` con `multipart/form-data`: upload file.
- `POST /api/client/knowledge/sources` con `{ "url": "https://..." }`: ingest URL.
- `POST /api/client/knowledge/retrieve` con `{ "query": "...", "basePrompt": "..." }`: costruisce il prompt con contesto RAG del tenant.

La UI è in `components/KnowledgeUpload.tsx` e viene usata dalla dashboard cliente. Mostra URL/file, stato `processing`, `ready` o `error` e messaggi di errore.

## Migration

Applicare:

```text
supabase/migrations/0008_knowledge_ingestion.sql
```

La migration crea `knowledge_sources`, `knowledge_chunks`, l’estensione `vector`, l’indice cosine e la funzione RPC `match_knowledge_chunks`. Tutti i record includono `org_id` e hanno policy RLS.

## Collegamento al prompt

Il retrieval è centralizzato in `lib/knowledge/rag.ts`:

```ts
const prompt = await buildKnowledgePrompt(orgId, userQuery, basePrompt)
```

L’endpoint `/api/client/knowledge/retrieve` espone la stessa funzione al layer assistente. Il consumer Vapi/LLM deve passare il prompt risultante al modello per ogni turno; non bisogna usare contesto di un altro `org_id`.

## Variabili

```env
FIRECRAWL_API_KEY=
UNSTRUCTURED_API_KEY=
UNSTRUCTURED_API_URL=https://api.unstructured.io/general/v0/general
OPENAI_API_KEY=
EMBEDDING_MODEL=text-embedding-3-small
```

Le chiavi sono server-side. Non esporle in componenti client, `.env.example` con valori reali o bundle browser.

## Osservabilità

Gli errori di ingestione vengono inviati agli helper Sentry con `org_id`; l’endpoint può essere ulteriormente tracciato su Langfuse quando il retrieval viene usato insieme a una chiamata LLM. I log non devono includere documenti completi, token API o dati personali non necessari.

## Stato integrazione webhook

Per WhatsApp e Web Chat, ogni messaggio in ingresso viene indicizzato e passato a `generateKnowledgeReply`: la risposta viene restituita al consumer nel campo `reply`, già generata con il contesto filtrato per `org_id`.

Per Vapi, gli eventi vocali ricevuti dal webhook producono il campo `rag_system_prompt` con il contesto tenant. Il webhook Vapi non può modificare retroattivamente il system prompt di una chiamata già in corso: per applicarlo durante la conversazione, il consumer Vapi deve usare il server URL/tool di richiesta assistente e applicare il prompt dinamico come assistant override. Il callback di report/fine chiamata resta utile per audit e arricchimento, non per cambiare il prompt della chiamata conclusa.

## Smoke test reale

Il runner è:

```bash
npm run test:knowledge-rag
```

Esegue Firecrawl, embedding OpenAI, scrittura su `knowledge_sources`/`knowledge_chunks`, webhook Web Chat, retrieval pgvector, risposta OpenAI e cleanup delle fixture. Nel test eseguito il crawling Firecrawl è arrivato correttamente al passaggio embedding; OpenAI ha risposto `429 credit_balance_exhausted`, quindi la risposta contestualizzata non ha potuto essere generata. Dopo il test la fixture tenant è stata eliminata.
