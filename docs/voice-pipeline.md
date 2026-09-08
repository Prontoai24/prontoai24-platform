# Pipeline voce ProntoAI24: Vapi, Telnyx ed ElevenLabs

## Stato tecnico

La pipeline applicativa è predisposta con Vapi come orchestratore, Telnyx come carrier e ElevenLabs come provider vocale. Il webhook pubblico è:

```text
https://prontoai24.it/api/webhooks/vapi
```

Gli eventi vengono inoltrati all’handler interno `/api/webhooks/ai/vapi`. Il backend risolve il tenant tramite `org_id`, `client_id`, `tenantId`, `assistantId`, `phoneNumberId`, `vapi_phone_id` o numero telefonico. Quando il tenant è risolto, aggiorna le tabelle `calls` e `conversations` tramite il client Supabase Admin.

Gli eventi supportati includono aggiornamenti di stato, inizio/fine chiamata, report di fine chiamata e trascrizioni. La registrazione, la durata, gli orari, la direzione e l’esito vengono normalizzati quando presenti nel payload Vapi.

## Migration

Applicare:

```text
supabase/migrations/0006_voice_calls_conversations.sql
```

La tabella `calls` contiene `org_id`, identificativo della chiamata provider, `conversation_id`, URL registrazione, durata, orari, numeri, stato ed esito. La tabella `conversations` contiene il transcript per tenant e conversazione. Entrambe hanno RLS per super-admin, admin gestore e client proprietario.

## Configurazione Vapi

1. Creare o aprire un assistant Vapi.
2. Impostare il server URL su `https://prontoai24.it/api/webhooks/vapi`.
3. Configurare gli eventi di chiamata, inclusi `status-update`, `transcript` e `end-of-call-report`.
4. Inserire il prompt in `docs/voice-assistant-prompt.md`.
5. Configurare il provider voce ElevenLabs con una voce italiana e il modello `eleven_multilingual_v2`, oppure il modello ElevenLabs scelto nel pannello Vapi.
6. Inserire il numero Telnyx importato in Vapi e associarlo all’assistant.
7. Se Vapi supporta un secret per il server URL, impostarlo uguale a `AI_WEBHOOK_SECRET` e inviarlo nell’header previsto dal provider. Il backend accetta `x-vapi-secret` e `x-prontoai-webhook-secret`.

## Configurazione Telnyx

1. Creare una connessione Voice API Telnyx.
2. Configurare il webhook voice della connessione sugli endpoint Telnyx già presenti nel progetto quando si desidera tracciare anche eventi carrier.
3. Cercare un numero italiano nel catalogo Telnyx. La disponibilità, la documentazione AGCOM e il prezzo dipendono dalla provincia e dal tipo di numero.
4. Associare il numero al messaging/voice profile corretto e importarlo in Vapi.
5. Salvare il mapping in `phone_numbers`, includendo `telnyx_number_id`, `vapi_phone_id`, `vapi_assistant_id` e `client_id`.

Telnyx non pubblica nella pagina generale consultata una tariffa italiana unica: il prezzo finale deve essere verificato per destinazione tramite account o rate sheet. Non è quindi corretto promettere un numero italiano di test gratuito.

## Stima del costo per minuto

Le componenti non sono tutte espresse nella stessa unità. La stima seguente separa costi fissi, voce, telephony e LLM.

| Componente | Base pubblica verificata | Nota |
|---|---:|---|
| Vapi hosting | **$0,05/min** | Hosting Vapi; STT, LLM e TTS sono esclusi e passati a costo. |
| Telnyx Voice API | **da $0,002/min** | Fee API indicata da Telnyx; il carrier/destination cost è aggiuntivo. |
| Telnyx SIP local | **da $0,005/min outbound** o **$0,0032/min inbound** | Valori pubblici di partenza, non tariffa italiana garantita. |
| ElevenLabs TTS Flash/Turbo | **circa $0,05/min equivalente** | La fatturazione primaria è per carattere, non per minuto. |
| ElevenLabs TTS Multilingual | **circa $0,10/min equivalente** | Equivalenza indicativa basata sui caratteri parlati. |
| LLM | variabile | Dipende da modello, prompt, output e cache. |

Per un caso inbound locale puramente indicativo, usando Vapi, la fee API Telnyx, inbound carrier da catalogo pubblico e TTS Flash/Turbo, il minimo teorico prima del modello LLM è circa:

```text
0,05 + 0,002 + 0,0032 + 0,05 = 0,1052 USD/minuto
```

Questo non è un preventivo italiano né un prezzo all-in. Non include tasse, numero telefonico mensile, compliance, registrazione/storage, eventuali trasferimenti, STT separato, margine Vapi su provider esterni o costi LLM.

Per il costo LLM, usare la formula:

```text
costo LLM/min = (input_token_per_min / 1.000.000 × prezzo_input)
              + (output_token_per_min / 1.000.000 × prezzo_output)
```

Il consumo varia durante una conversazione perché lo storico cresce. Per una stima affidabile bisogna misurare token reali su una chiamata campione e moltiplicare per i minuti effettivi.

## Logging e privacy

Ogni evento voice viene registrato su Sentry con il tag `org_id`. Langfuse registra un evento `voice-<event>` con `org_id`, durata e presenza di transcript/recording, senza inviare il transcript completo come metadata. Password, token, documenti e dati di pagamento non devono essere inclusi nei payload tracciati.

## Test

Il test sicuro in staging deve usare un numero e credenziali provider dedicati. La sequenza è:

1. inviare un evento `status-update` al webhook;
2. verificare il record `calls` per `org_id` e `provider_call_id`;
3. inviare un `transcript` e verificare l’upsert in `conversations`;
4. inviare un `end-of-call-report` con durata e recording URL;
5. verificare l’evento Sentry e la trace Langfuse;
6. effettuare una chiamata reale soltanto dopo aver verificato tariffa del numero, destinazione e limite di spesa.

La chiamata reale e l’acquisto/importazione del numero possono generare costi e richiedono quindi autorizzazione esplicita prima dell’esecuzione.

## Riferimenti

[1]: https://vapi.ai/pricing "Vapi pricing"
[2]: https://docs.vapi.ai/assistants/model-intelligence/understanding-cost "Vapi cost model"
[3]: https://telnyx.com/pricing/voice-api "Telnyx Voice API pricing"
[4]: https://telnyx.com/pricing/elastic-sip "Telnyx SIP Trunking pricing"
[5]: https://telnyx.com/pricing/numbers "Telnyx Global Numbers pricing"
[6]: https://elevenlabs.io/pricing/api "ElevenLabs API pricing"
[7]: https://elevenlabs.io/docs/eleven-agents/customization/llm "ElevenLabs Agents LLM costs"
[8]: https://platform.openai.com/docs/pricing "OpenAI API pricing"
[9]: https://platform.claude.com/docs/en/about-claude/pricing "Anthropic API pricing"
