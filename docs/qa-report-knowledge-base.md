# Report QA e Code Review — Data Ingestion / Knowledge Base

**Piattaforma:** ProntoAI24  
**Ambito:** Prompt 2 — Data ingestion / knowledge base (Firecrawl + Unstructured)  
**Ruolo di revisione:** Senior Software Architect / Expert QA Engineer  
**Data:** 9 settembre 2026  
**Base della verifica:** codice sorgente, migration SQL, documentazione, script E2E e dipendenze presenti nel repository.

## 1. Esito globale

### **APPROVATO CON RISERVA**

Il nucleo funzionale della Knowledge Base è presente e coerente con un MVP: la migration abilita `pgvector`, crea le tabelle per le fonti e i chunk, applica l’isolamento per `org_id`, integra Firecrawl per l’estrazione Markdown, Unstructured per i documenti quando configurato, `pdf-parse` come fallback, OpenAI Embeddings, retrieval cosine e iniezione del contesto nel prompt RAG.

L’implementazione non è però pienamente conforme al task originale per quattro motivi principali. Il file viene salvato in Supabase Storage e non in Cloudflare R2. Il `content_hash` viene calcolato ma non viene usato per impedire duplicati. La pipeline è sincrona e non applica rate limiting né retry strutturati. Infine, l’RPC SQL di similarità accetta un `match_org_id` fornito dal chiamante senza verificare internamente che corrisponda al tenant autenticato; oggi il consumer server-side passa il tenant corretto, ma l’RPC deve essere hardenizzato prima di considerare chiuso il requisito di isolamento.

## 2. Matrice di conformità

| Task originale | Stato | Note e rilievi |
|---|---|---|
| Tabella `knowledge_sources` con `id`, `org_id`, `type`, `source_value`, `status`, `content_hash`, `created_at`, `updated_at` | **Conforme** | Tutti i campi richiesti sono presenti. Sono presenti anche `error_message` e la foreign key verso `clients(id)`. |
| Constraint per tipo e stato | **Conforme con riserva** | Sono presenti `CHECK` su `type` e `status`. Non sono stati creati ENUM dedicati, ma il comportamento è equivalente per l’MVP. |
| RLS sulle fonti | **Conforme con riserva** | Le policy distinguono Super Admin, Admin gestore e Client tenant. L’API usa Service Role dopo aver risolto il client dalla sessione. È comunque opportuno aggiungere test SQL automatici e policy esplicite `WITH CHECK`. |
| `pgvector` e tabella vettoriale | **Conforme** | `vector` è abilitato; `knowledge_chunks.embedding` è `vector(1536)`; indice IVFFlat cosine e RPC di match presenti. |
| Isolamento `org_id` nel retrieval | **Parzialmente conforme** | `retrieveKnowledge` filtra per `org_id` e la funzione RPC filtra `kc.org_id`. L’RPC non verifica internamente l’identità del chiamante, quindi non deve essere esposto direttamente a client autenticati. |
| Crawling web con Firecrawl | **Parzialmente conforme** | È implementato `POST https://api.firecrawl.dev/v2/scrape` con Markdown e `onlyMainContent`. È scraping di una URL, non crawling multi-pagina di un dominio. |
| Testo web pulito | **Conforme con riserva** | Firecrawl restituisce Markdown pulito. Il fallback senza Firecrawl rimuove tag HTML con regex, soluzione accettabile solo per pagine statiche semplici. |
| Rate limiting ingestion | **Non conforme** | Non risultano limiti per URL, upload, richieste Firecrawl, parsing o embedding. |
| Error handling e stati `ready`/`error` | **Parzialmente conforme** | Gli errori vengono restituiti e osservati, ma la fonte viene inserita in `processing` solo dopo crawl/parse. Se crawl o parsing fallisce, non esiste una fonte persistita da aggiornare a `error`. |
| Upload su Cloudflare R2 | **Non conforme rispetto al task** | Il codice usa il bucket privato Supabase Storage `knowledge-base`. R2 è documentato come architettura prevista, ma non è usato dalla pipeline Knowledge Base. |
| Parsing Unstructured | **Conforme con riserva** | La Partition API viene chiamata quando `UNSTRUCTURED_API_KEY` è disponibile. PDF, TXT, MD e CSV hanno fallback locali; DOC/DOCX richiedono Unstructured. |
| `content_hash` e deduplicazione | **Non conforme** | SHA-256 viene calcolato dopo l’estrazione e salvato, ma non viene confrontato prima dell’ingestion. Non esiste un indice univoco `(org_id, content_hash)` né una risposta `duplicate`. |
| Chunking | **Conforme per MVP** | Chunk di circa 1.200 caratteri con overlap di 180. Il taglio è per caratteri e può spezzare paragrafi o token. |
| Embedding | **Conforme con riserva** | Usa `text-embedding-3-small` e dimensione 1536. L’inserimento batch è presente, ma non ci sono retry, batch-size configurabile o gestione parziale delle risposte. |
| Decisione pgvector vs servizio esterno | **Conforme per MVP** | La scelta è operativamente ed economicamente ragionevole: Supabase, RLS e vettori restano nello stesso ambiente. |
| UI upload, URL e stato | **Parzialmente conforme** | Sono presenti upload, input URL e lista delle fonti. La lista viene aggiornata dopo una richiesta riuscita, ma non esiste polling, Realtime subscription o aggiornamento continuo durante l’elaborazione. |
| Iniezione contesto RAG nel system prompt | **Conforme** | `buildKnowledgePrompt` e `generateKnowledgeReply` inseriscono il contesto recuperato nel prompt con istruzioni anti-allucinazione. |
| Smoke test E2E | **Parzialmente conforme** | Lo script verifica Firecrawl, embedding, scrittura pgvector, webhook Web Chat e risposta RAG. Scrive direttamente nel DB invece di testare l’intera API ingestion e non copre Unstructured, Storage, deduplica, rate limiting o UI. |

## 3. Analisi tecnica

### 3.1 Schema, pgvector e multi-tenancy

La migration `0008_knowledge_ingestion.sql` è strutturalmente corretta. `knowledge_sources.org_id` e `knowledge_chunks.org_id` referenziano `clients(id)` con cancellazione a cascata. La tabella dei chunk conserva anche `source_id`, `chunk_index`, testo, embedding e metadati. La combinazione di indice IVFFlat con `vector_cosine_ops` e funzione `match_knowledge_chunks` è appropriata per il volume atteso di un MVP.

L’isolamento applicativo è buono nei percorsi esposti al cliente. `currentClient()` risolve il tenant mediante `clients.profile_id = auth.uid()`, e il retrieval passa esclusivamente quell’ID alla funzione. Le policy RLS sono inoltre coerenti con la gerarchia `super_admin -> admin -> client`.

Esiste però un rischio importante nell’RPC. La funzione accetta `match_org_id` come parametro e non controlla `auth.uid()` al proprio interno. Se il ruolo EXECUTE fosse disponibile a un utente autenticato, un client potrebbe invocare direttamente l’RPC con l’ID di un altro tenant. Il Service Role bypassa RLS e non elimina questo problema di esposizione dell’RPC. La funzione deve essere resa non eseguibile dai ruoli applicativi oppure deve calcolare e verificare il tenant internamente.

### 3.2 Firecrawl

L’integrazione usa l’endpoint Firecrawl v2 `/scrape`, richiede Markdown e limita l’estrazione al contenuto principale. Questo è sufficiente per acquisire una singola pagina. Non è però un crawler di dominio: non segue link, non limita il numero di pagine e non gestisce sitemap, profondità o budget di crawling.

La gestione degli errori HTTP è corretta a livello minimo, ma mancano retry con backoff per errori transitori, timeout esplicito, circuit breaker e rate limiting per tenant. Inoltre, l’URL viene passato a `fetch` o Firecrawl dopo una validazione sintattica molto debole. È necessario prevenire SSRF verso indirizzi privati, loopback, metadata endpoint e reti interne.

### 3.3 File, storage e parsing

La pipeline principale salva i file nel bucket privato Supabase Storage `knowledge-base` con path prefissato dal tenant. Questo garantisce isolamento logico del path, ma non soddisfa il requisito Cloudflare R2 espresso nel task originale. Il file `app/api/client/knowledge/route.ts` usa anch’esso Supabase Storage e una tabella legacy `knowledge_documents`, mentre la pipeline principale usa `knowledge_sources` e `knowledge_chunks`. Sono quindi presenti due percorsi documentali parzialmente sovrapposti che aumentano il debito tecnico.

Unstructured è integrato correttamente come chiamata multipart alla Partition API. Il fallback locale è utile per TXT, Markdown, CSV e PDF semplici. Non copre però in modo affidabile PDF scansionati, OCR, tabelle complesse e layout multipagina senza Unstructured o un servizio OCR dedicato.

### 3.4 Hash e deduplicazione

`contentHash(text)` usa SHA-256 correttamente sul testo normalizzato? Il codice calcola l’hash sul testo passato, ma il testo non viene normalizzato dentro `contentHash`; quindi variazioni di whitespace possono produrre hash diversi. Soprattutto, l’hash viene scritto solo dopo l’estrazione e il chunking. Non è usato in una query preventiva e non esiste un vincolo di unicità per tenant.

Di conseguenza, due upload uguali o due richieste dello stesso URL creano due fonti e due serie di chunk. Questo viola il requisito di prevenzione dell’ingestion duplicata.

### 3.5 Pipeline, stati e affidabilità operativa

L’ingestion è eseguita interamente nella request HTTP. La sequenza è upload/parsing o crawl, inserimento fonte, embedding, inserimento chunk e aggiornamento stato. Per file o siti lunghi, questa sequenza può superare timeout e limiti di memoria delle funzioni serverless.

Lo stato `processing` viene scritto troppo tardi. Se Firecrawl, Unstructured, `pdf-parse` o il caricamento Storage fallisce, la fonte non è ancora presente nella tabella e non può essere marcata `error`. Il client riceve un 500 ma perde la persistenza dello stato operativo. La soluzione raccomandata è creare subito la fonte in `pending`, aggiornarla a `processing`, eseguire il job e aggiornare a `ready` oppure `error` in un blocco finale.

### 3.6 Frontend e UX

`KnowledgeUpload.tsx` offre i controlli richiesti e aggiorna la lista dopo un upload o URL completato. Non mostra però avanzamento per singola fonte, errore persistito o aggiornamento in tempo reale durante un job asincrono. Poiché oggi l’elaborazione è sincrona, il limite è mascherato dal tempo di attesa della richiesta.

La UI accetta estensioni `.doc` e `.docx`, ma l’API delega realmente il parsing a Unstructured solo quando la chiave è disponibile. Senza chiave, l’utente riceve un errore dopo l’upload, mentre il file può essere già stato salvato nello storage. È necessario eliminare il file in caso di fallimento o rendere esplicita la coda di errore.

## 4. Analisi criticità e bug

| Severità | Criticità | Impatto | Azione raccomandata |
|---|---|---|---|
| **Alta** | RPC `match_knowledge_chunks` parametrica senza controllo interno dell’utente | Possibile retrieval cross-tenant se l’RPC è invocabile dal ruolo autenticato | Revocare `EXECUTE` ai ruoli client oppure verificare internamente il tenant derivato da `auth.uid()`. |
| **Alta** | URL ingestion vulnerabile a SSRF | Il server può essere indotto a chiamare endpoint interni o metadata service | Consentire solo `http/https`, risolvere DNS, bloccare IP privati/loopback/link-local, imporre timeout e redirect policy. |
| **Alta** | Deduplicazione non implementata | Re-ingestion e crescita inutile di storage/costi embedding | Indice univoco per `(org_id, content_hash)` e controllo prima dell’embedding. |
| **Media** | R2 non implementato nella pipeline | Non conformità allo storage richiesto e divergenza dalla documentazione architetturale | Implementare adapter S3-compatible R2 server-side o dichiarare formalmente Supabase Storage come scelta MVP. |
| **Media** | Stato `error` non persistito per errori di crawl/parse/upload | UI e operatori non vedono le fonti fallite | Creare la fonte prima del job e aggiornare sempre lo stato in `finally`/catch. |
| **Media** | Nessun rate limiting ingestion | Abuso costoso di Firecrawl/OpenAI e saturazione delle funzioni | Limite per `org_id` e IP, quota giornaliera e lock su fonte in processing. |
| **Media** | Pipeline sincrona | Timeout, memoria elevata e retry involontari | Spostare parsing/embedding in una coda o job Inngest e restituire subito `202`. |
| **Media** | Due modelli documentali (`knowledge_documents` e `knowledge_sources`) | Confusione operativa e rischio di percorsi non indicizzati | Unificare schema, API e UI in un solo modello. |
| **Bassa** | Chunking a caratteri | Frammentazione di paragrafi e qualità retrieval non ottimale | Chunking per paragrafi/sentence con limite token e overlap configurabile. |
| **Bassa** | Fallback HTML con regex | Testo rumoroso e perdita di struttura semantica | Usare parser HTML dedicato o disabilitare il fallback in produzione. |
| **Bassa** | Smoke test scrive direttamente su DB | Non verifica completamente l’API reale di ingestion | Aggiungere test autenticato dell’endpoint con file e URL, più test di cleanup e duplicate. |

## 5. Code review snippets e correzioni precise

### 5.1 Hardening dell’RPC di retrieval

Opzione preferita: rendere l’RPC non invocabile dai client e consentire l’uso solo dal backend con Service Role.

```sql
revoke execute on function match_knowledge_chunks(vector, uuid, float, int)
from anon, authenticated;
```

Se è necessario consentire l’RPC a utenti autenticati, il tenant non deve essere un parametro libero. La funzione deve derivare l’ID dal profilo:

```sql
create or replace function match_knowledge_chunks(
  query_embedding vector(1536),
  match_threshold float default 0.72,
  match_count int default 8
)
returns table (
  id uuid,
  source_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select kc.id,
         kc.source_id,
         kc.content,
         kc.metadata,
         1 - (kc.embedding <=> query_embedding) as similarity
  from knowledge_chunks kc
  join clients c on c.id = kc.org_id
  where c.profile_id = auth.uid()
    and kc.embedding is not null
    and 1 - (kc.embedding <=> query_embedding) >= match_threshold
  order by kc.embedding <=> query_embedding
  limit least(match_count, 20);
$$;
```

### 5.2 Deduplicazione per tenant

Aggiungere un vincolo univoco e una query preventiva:

```sql
create unique index if not exists knowledge_sources_org_hash_uidx
on knowledge_sources(org_id, content_hash)
where content_hash is not null;
```

Nel codice, normalizzare prima dell’hash:

```ts
export function contentHash(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex')
}
```

Prima di creare i chunk:

```ts
const hash = contentHash(text)
const { data: duplicate } = await admin
  .from('knowledge_sources')
  .select('id,status')
  .eq('org_id', orgId)
  .eq('content_hash', hash)
  .maybeSingle()

if (duplicate) {
  return { duplicate: true, sourceId: duplicate.id, status: duplicate.status }
}
```

### 5.3 Lifecycle corretto della fonte

La fonte deve essere creata prima del crawl o parsing:

```ts
const { data: source, error } = await admin
  .from('knowledge_sources')
  .insert({
    org_id: client.id,
    type,
    source_value: sourceValue,
    status: 'pending',
  })
  .select('id')
  .single()

if (error || !source) throw error || new Error('Fonte non creata')

try {
  await admin
    .from('knowledge_sources')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', source.id)

  const text = type === 'url' ? await crawlUrl(sourceValue) : await parseFile(file)
  const result = await indexKnowledgeSource(source.id, client.id, text, metadata)

  await admin
    .from('knowledge_sources')
    .update({ status: 'ready', error_message: null, updated_at: new Date().toISOString() })
    .eq('id', source.id)

  return result
} catch (error) {
  await admin
    .from('knowledge_sources')
    .update({
      status: 'error',
      error_message: error instanceof Error ? error.message : 'Indicizzazione fallita',
      updated_at: new Date().toISOString(),
    })
    .eq('id', source.id)
  throw error
}
```

### 5.4 Validazione anti-SSRF

La regex attuale valida solo la forma generale dell’URL. Per produzione occorre rifiutare reti non pubbliche:

```ts
import dns from 'node:dns/promises'
import net from 'node:net'

function isPrivateAddress(address: string) {
  return net.isIP(address) === 4 && (
    address.startsWith('10.') ||
    address.startsWith('127.') ||
    address.startsWith('169.254.') ||
    address.startsWith('192.168.') ||
    address.startsWith('172.16.') ||
    address.startsWith('172.17.') ||
    address.startsWith('172.18.') ||
    address.startsWith('172.19.') ||
    address.startsWith('172.2') ||
    address.startsWith('172.3')
  )
}

export async function assertPublicUrl(raw: string) {
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Protocollo URL non consentito')
  if (url.username || url.password) throw new Error('Credenziali URL non consentite')
  const addresses = await dns.lookup(url.hostname, { all: true })
  if (addresses.some(({ address }) => isPrivateAddress(address))) throw new Error('Host non pubblico')
  return url
}
```

La validazione deve essere applicata prima di Firecrawl e prima del fallback `fetch`. In produzione vanno inoltre imposti timeout e gestione sicura dei redirect.

### 5.5 Stato `ready` e gestione embedding

Attualmente l’assenza di `OPENAI_API_KEY` inserisce chunk con embedding `null` e marca la fonte `error`. È preferibile non dichiarare indicizzato un contenuto privo di vettori, mantenere lo stato `processing` o usare uno stato distinto `extracted`:

```ts
if (!embeddings?.length) {
  await admin.from('knowledge_sources').update({
    status: 'error',
    error_message: 'Embedding provider non configurato',
    updated_at: new Date().toISOString(),
  }).eq('id', sourceId)
  throw new Error('Embedding provider non configurato')
}
```

## 6. Piano di chiusura QA

Prima dell’approvazione senza riserve devono essere completati i seguenti interventi:

1. Hardening dell’RPC e test di tentativo cross-tenant con due utenti client.
2. Implementazione della deduplicazione con indice unico e test di doppio upload.
3. Persistenza dello stato `error` per ogni fallimento della pipeline.
4. Protezione SSRF, timeout, retry e rate limiting per URL ingestion.
5. Decisione formale tra Supabase Storage e Cloudflare R2, con allineamento di codice e documentazione.
6. Spostamento dei lavori pesanti in un job asincrono e aggiornamento UI tramite polling o Supabase Realtime.
7. Test E2E dell’endpoint reale per URL e multipart file, inclusi PDF multipagina, DOCX, contenuti vuoti e duplicati.

## 7. Conclusione

La piattaforma dispone di una base RAG valida per un MVP controllato. La scelta pgvector è appropriata, l’isolamento applicativo è ben impostato e il percorso Firecrawl/OpenAI/Web Chat è stato verificato con smoke test. Non è tuttavia corretto dichiarare il Prompt 2 completamente chiuso: R2 non è ancora il backend storage della pipeline, la deduplicazione è solo preparatoria, l’RPC richiede hardening e il lifecycle asincrono degli stati non è ancora production-grade.

### Riferimenti

[1]: ../supabase/migrations/0008_knowledge_ingestion.sql "Migration knowledge ingestion e pgvector"
[2]: ../lib/knowledge/ingestion.ts "Pipeline ingestion, chunking, hash, embedding e retrieval"
[3]: ../lib/knowledge/rag.ts "Costruzione del prompt RAG e generazione risposta"
[4]: ../app/api/client/knowledge/sources/route.ts "API fonti Knowledge Base"
[5]: ../components/KnowledgeUpload.tsx "Componente UI upload e fonti"
[6]: ../scripts/test-knowledge-rag-e2e.mjs "Smoke test E2E Firecrawl, embedding e Web Chat"
[7]: ../docs/knowledge-base.md "Documentazione Knowledge Base e RAG"
[8]: ../supabase/migrations/0001_schema_iniziale.sql "Schema iniziale, clienti, profili e RLS"
