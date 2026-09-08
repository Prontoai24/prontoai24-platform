# Osservabilità ProntoAI24

## Stato dell’integrazione

Il progetto integra `@sentry/nextjs` per error tracking client, server ed edge e `@langfuse/openai` per tracciare automaticamente le chiamate OpenAI. Il tracing Langfuse usa Langfuse Cloud tramite `LANGFUSE_HOST`/`LANGFUSE_BASE_URL`. Le chiavi restano esclusivamente server-side.

Il tag comune è sempre:

```text
org_id=<tenant-id oppure default>
```

Finché il contesto tenant non è disponibile viene usato `default`. Quando una route conosce il tenant, deve passare il relativo identificativo al wrapper o al helper Sentry.

## Variabili d’ambiente

Configurare in Vercel, separando Development, Preview e Production:

```text
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_HOST=https://cloud.langfuse.com
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OBSERVABILITY_DEFAULT_ORG_ID=default
```

`SENTRY_AUTH_TOKEN` serve soltanto durante il build per caricare le sourcemap; non deve essere esposto al browser. Il DSN Sentry può essere pubblico, ma va comunque configurato come variabile `NEXT_PUBLIC_*`.

## Dashboard Sentry

Sentry raccoglie eccezioni React, errori server-side, errori Edge e performance traces. Per analizzare un problema:

1. aprire il progetto Sentry `javascript-nextjs`;
2. entrare in **Issues** e filtrare per `level:error` o `level:fatal`;
3. filtrare per `org_id:<tenant-id>` per isolare un cliente;
4. usare la sezione **Stack Trace** con le sourcemap caricate dal build Vercel;
5. controllare breadcrumbs, release, URL e runtime;
6. confrontare il volume nella sezione **Discover/Performance**.

### Alert errori

Nel progetto Sentry creare un alert in **Alerts → Create Alert → Issues** con:

- filtro: `level:error OR level:fatal`;
- frequenza: immediata per errori nuovi o soglia configurata per errori ricorrenti;
- azione: email al team oppure webhook verso il sistema operativo;
- tag obbligatorio nei filtri: `org_id` quando l’alert deve essere tenant-specifico.

La definizione degli alert è una configurazione di progetto Sentry e non viene salvata nel repository. Deve essere completata dopo il login al progetto Sentry e verificata con un errore di test non sensibile.

## Dashboard Langfuse

Langfuse mostra le tracce LLM, le generation, la latenza, i token e i costi. Per l’analisi:

1. aprire **Traces** su `https://cloud.langfuse.com`;
2. filtrare per `org_id:<tenant-id>`;
3. usare `feature`, `session_id` e `user_id` per restringere il contesto;
4. aprire una trace per vedere la gerarchia di span e generation;
5. controllare modello, token, latenza, input/output e stato errore;
6. usare **Dashboard** per confrontare costo e qualità per feature o tenant.

Gli input tracciati devono essere minimizzati e non devono contenere password, token, documenti fiscali o dati personali non necessari.

## Aggiungere tracing OpenAI a un endpoint

Importare il factory server-side e creare il client con il contesto tenant:

```ts
import { createObservedOpenAI } from '@/lib/observability/langfuse'

export async function POST(request: Request) {
  const { message, clientId } = await request.json()
  const openai = createObservedOpenAI({
    orgId: clientId || 'default',
    feature: 'chatbot-response',
  })

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: message }],
  })

  return Response.json({ text: response.choices[0]?.message?.content || '' })
}
```

Il wrapper registra modello, token, costi e latenza come generation Langfuse e aggiunge `org_id` sia come tag sia come metadata.

## Aggiungere tracing ad Anthropic o a un provider custom

Per un SDK senza integrazione automatica usare `traceLlmCall`:

```ts
import { traceLlmCall } from '@/lib/observability/langfuse'

const result = await traceLlmCall(
  'faq-answer',
  { orgId: clientId, feature: 'faq-answer' },
  { question: question.slice(0, 500) },
  () => anthropic.messages.create({
    model: 'claude-3-5-sonnet-latest',
    max_tokens: 500,
    messages: [{ role: 'user', content: question }],
  }),
)
```

Il wrapper chiude la generation anche in caso di errore e forza il flush prima di restituire il controllo in contesti serverless brevi.

## Sentry in codice applicativo

Per catturare un’eccezione con il tenant corretto:

```ts
import { captureObservedException } from '@/lib/observability/sentry'

try {
  await operation()
} catch (error) {
  captureObservedException(error, clientId, { feature: 'provisioning' })
  throw error
}
```

Per un evento operativo non bloccante:

```ts
import { captureObservedMessage } from '@/lib/observability/sentry'

captureObservedMessage('Provider retry scheduled', 'warning', clientId, {
  provider: 'telnyx',
})
```

## Verifica locale

Prima del deploy eseguire:

```bash
npx tsc --noEmit
npm run build
```

Per verificare Langfuse in un endpoint reale, usare un ambiente con le chiavi configurate e controllare che la trace compaia nella dashboard dopo l’esecuzione. Non usare chiavi reali in commit, fixture, screenshot o log CI.
