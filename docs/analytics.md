# Dashboard analytics AI

La dashboard `/admin/report` espone metriche applicative persistite in `ai_usage_events` e filtrate per ruolo e tenant.

## Metriche

| Metrica | Origine | Descrizione |
|---|---|---|
| Conversazioni AI | eventi RAG riusciti/errore | Numero di richieste AI nel periodo |
| Token consumati | `input_tokens + output_tokens` | Token restituiti dal provider |
| Costo stimato | token × tariffa configurata | Stima USD, non fattura provider |
| Latenza media | `latency_ms` | Tempo della chiamata chat RAG |
| Volumi canale | `channel` | voice, WhatsApp, Web Chat |
| Breakdown tenant | `org_id` | Aggregazione isolata per cliente |

## Flusso

Il webhook omnicanale invoca `generateKnowledgeReply`. La funzione recupera il contesto pgvector, invia il prompt a OpenAI e legge `usage` dalla risposta. L’handler salva token, modello, latenza e costo in `ai_usage_events`.

Il costo viene calcolato con:

```env
RAG_INPUT_COST_USD_PER_1K=0.00015
RAG_OUTPUT_COST_USD_PER_1K=0.0006
```

Questi valori sono configurabili e devono essere aggiornati quando cambia il modello o il listino del provider. Sono stime operative e non sostituiscono la fatturazione ufficiale.

## API

```http
GET /api/admin/analytics?days=30
```

L’API limita gli admin ai client con `managed_by_admin = auth.uid()`. Il super-admin vede tutti i tenant. I risultati includono `totals`, `daily`, `byChannel` e `byTenant`.

## Migration

Applicare:

```text
supabase/migrations/0009_ai_usage_events.sql
```

La tabella include RLS e la foreign key verso `clients(id)`. Gli eventi vengono deduplicati tramite `request_id`.
