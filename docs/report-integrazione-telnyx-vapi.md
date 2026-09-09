# Report di stato: onboarding multi-tenant, Telnyx e Vapi

**Data:** 7 settembre 2026  
**Progetto:** ProntoAI24 Platform  
**Ambito:** verifica del prompt `pasted_content_3.txt` sul flusso integrato di onboarding, numerazione, compliance, SMS e fonia AI.

## Conclusione esecutiva

Il codebase dispone già di una base funzionale per la gestione dei clienti, la ricerca dei numeri Telnyx, l’ordine di numerazioni e il provisioning Vapi. Non è però ancora presente un flusso end-to-end gestibile esclusivamente dalla dashboard SuperAdmin.

Le parti mancanti più rilevanti sono la compliance italiana Telnyx, l’upload dei documenti, la persistenza dell’ID dell’ordine Telnyx, il webhook dedicato agli aggiornamenti degli ordini, l’invio SMS post-ordine e l’integrazione del provisioning nella schermata di creazione cliente.

Inoltre, il webhook Vapi esistente deve essere allineato al payload documentato dal provider: gli eventi Vapi sono normalmente incapsulati in `message`, mentre l’implementazione corrente legge principalmente il payload al livello radice.

## Matrice di stato

| Area | Stato | Evidenza nel codice | Valutazione |
|---|---|---|---|
| Ricerca numeri Telnyx | Parzialmente pronta | `GET /api/admin/provisioning/telnyx` | La route inoltra i query parameter a Telnyx, ma non esiste ancora una UI dedicata con filtri italiani e validazione dei risultati. |
| Ordine numeri Telnyx | Parzialmente pronta | `POST /api/admin/provisioning/telnyx` | L’ordine invia numeri, `connection_id` e `messaging_profile_id`, ma non associa un `requirement_group_id` e non persiste l’ordine nel database. |
| Compliance italiana | Non pronta | Nessuna route Telnyx dedicata | Mancano creazione e compilazione dei requirement group, upload documenti e gestione degli stati regolatori. |
| Webhook Telnyx | Non pronto | Nessuna `/api/webhooks/telnyx` dedicata | La route generica accetta `telnyx`, ma non aggiorna numeri, ordini o requirement group. |
| Messaging profile | Configurazione parziale | `TELNYX_MESSAGING_PROFILE_ID`, usato nell’ordine | Manca l’associazione esplicita del numero al profilo e manca una verifica/configurazione del webhook messaging. |
| SMS post-ordine | Non pronto | Nessun servizio `/v2/messages` | Non esiste ancora una route o servizio per inviare notifiche SMS e registrare il relativo stato. |
| Creazione assistente Vapi | Pronta a livello API | `POST /api/admin/provisioning/vapi` | Crea l’assistente con prompt e modello personalizzabili. |
| Importazione numero in Vapi | Pronta a livello API | `POST /api/admin/provisioning/vapi` | Importa un numero Telnyx e lo collega all’assistente. Richiede numero già acquistato e configurato correttamente. |
| Webhook Vapi | Parzialmente pronto | `/api/webhooks/vapi` e `/api/webhooks/ai/[provider]` | Salva log chiamate, ma il mapping del payload deve gestire `payload.message` e la verifica firma/auth deve essere rafforzata. |
| Persistenza multi-tenant | Parzialmente pronta | `clients`, `phone_numbers`, `call_logs` | Esiste `client_id`; mancano `telnyx_order_id` e campi di stato più completi per compliance e provisioning. |
| UI onboarding completo | Non pronto | `/admin/clienti/nuovo` | La schermata gestisce anagrafica, listino e invito, ma non ricerca numeri, documenti, compliance, ordine, SMS o Vapi. |

## Analisi per area

### 1. Ricerca e acquisto dei numeri

La route `app/api/admin/provisioning/telnyx/route.ts` implementa una ricerca proxy verso `GET https://api.telnyx.com/v2/available_phone_numbers` e un ordine verso `POST https://api.telnyx.com/v2/number_orders`. Le credenziali restano server-side e la route limita l’accesso a utenti `admin` e `super_admin`.

L’implementazione non realizza ancora il workflow richiesto dal prompt. I parametri sono inoltrati in modo generico e non esiste una UI che selezioni esplicitamente paese `IT`, tipo di numero, prefisso o città. La richiesta di ordine inserisce `connection_id` e `messaging_profile_id` a livello principale, ma non gestisce il requisito regolatorio italiano per ogni numero ordinato.

La documentazione Telnyx indica che per l’Italia i requirement group compilati sono obbligatori per gli ordini di numeri. Il requisito deve essere associato agli oggetti `phone_number` dell’ordine e deve corrispondere a paese, tipo di numero e azione dell’ordine.[1]

### 2. Compliance e documenti

Non sono presenti route per `POST /v2/documents`, `POST /v2/requirement_groups` o `PATCH /v2/requirement_groups/:id`. Non è presente una UI per ragione sociale, partita IVA, indirizzo, visura camerale e documento del legale rappresentante.

Lo schema contiene soltanto `phone_numbers.requirement_group_id`. Questo campo è utile, ma non è sufficiente per tracciare documenti, requisiti, stato di revisione, commenti Telnyx, scadenze o motivo di rifiuto.

Per l’Italia è importante distinguere gli stati `requirement-info-pending`, `requirement-info-under-review`, `requirement-info-exception` e `approved`. Il flusso deve permettere la correzione e il reinvio dei requisiti rifiutati, invece di trattare l’ordine come semplicemente attivo o non attivo.[2]

### 3. Webhook Telnyx e stato ordine

Non esiste `app/api/webhooks/telnyx/route.ts`. La route generica `/api/webhooks/ai/telnyx` accetta il provider, ma gestisce solo il riconoscimento dell’evento e l’audit log. Non aggiorna `phone_numbers.status`, non salva `telnyx_order_id` e non registra lo stato del requirement group.

La documentazione Telnyx prevede notifiche per gli aggiornamenti degli ordini e per i cambi di stato dei requirement group. Il sistema dovrebbe ricevere tali eventi, validare la firma del webhook e aggiornare le entità tenant corrette.[1] [2]

### 4. Messaging profile e SMS

Il provisioning Telnyx legge `TELNYX_MESSAGING_PROFILE_ID` e lo invia durante la creazione dell’ordine. Questo non sostituisce l’associazione esplicita del numero al messaging profile dopo la sua attivazione.

Telnyx descrive il messaging profile come l’oggetto che raggruppa numeri, webhook, impostazioni di consegna e limiti di spesa. Ogni numero usato per il messaging deve essere assegnato a un messaging profile, che deve avere un webhook configurato per ricevere messaggi in ingresso e stati di consegna.[3]

Nel repository non esiste ancora un servizio che chiami `POST /v2/messages`. Di conseguenza il requisito di invio SMS post-ordine non è implementato. Mancano inoltre idempotenza, registrazione del `provider_message_id`, stato `sent/delivered/failed` e gestione dei retry.

### 5. Vapi e fonia AI

La route `app/api/admin/provisioning/vapi/route.ts` è la parte più avanzata. Verifica il ruolo admin, legge il cliente con il client Admin, crea un assistente tramite `POST /assistant`, importa il numero tramite `POST /phone-number` e salva il collegamento nella tabella `phone_numbers`.

Il prompt dell’assistente può essere personalizzato tramite il campo `assistant`, ma la route non costruisce ancora automaticamente un prompt completo con catalogo prezzi, istruzioni dell’attività e configurazioni specifiche del tenant. Il catalogo è quindi disponibile nel sistema, ma non risulta integrato automaticamente nel prompt Vapi.

L’importazione del numero in Vapi presuppone che il numero sia già stato acquistato da Telnyx e che `TELNYX_CONNECTION_ID` sia valido. Non è un sostituto del workflow Telnyx di compliance e provisioning.

### 6. Webhook Vapi e isolamento tenant

La route `/api/webhooks/vapi` inoltra il body a `/api/webhooks/ai/vapi`. La route generica ricava l’identificativo tenant da `client_id`, `tenantId`, `tenant_id` o dai metadata. Come fallback cerca `vapi_phone_id` o `phone_number` in `phone_numbers`.

La documentazione Vapi mostra invece un body con un oggetto `message`, e gli eventi comuni espongono `message.call`, `message.phoneNumber`, `message.assistant` e `message.artifact`. Gli eventi di fine chiamata includono registrazione, trascrizione e motivo di chiusura.[4]

L’implementazione corrente legge principalmente `payload.call` e `payload` al livello radice. Questo può causare mancata risoluzione del tenant o perdita di trascrizione e registrazione per gli eventi reali. Deve essere aggiunto il supporto a `payload.message` e a tutti i relativi campi.

### 7. Schema multi-tenant

Lo schema iniziale contiene correttamente `client_id` in `phone_numbers` e `call_logs`, oltre alle policy RLS per super admin, admin gestore e client proprietario. Sono presenti anche `requirement_group_id` e `vapi_phone_id`.

Mancano però almeno i seguenti campi per completare il tracciamento:

| Tabella | Campo consigliato | Scopo |
|---|---|---|
| `phone_numbers` | `telnyx_order_id` | Collegare il numero all’ordine Telnyx. |
| `phone_numbers` | `messaging_profile_id` | Tracciare il profilo messaging assegnato. |
| `phone_numbers` | `compliance_status` | Distinguere attesa, revisione, eccezione e approvazione. |
| `phone_numbers` | `status_updated_at` | Mostrare l’ultimo aggiornamento operativo. |
| `clients` | `telnyx_requirement_group_id` | Riutilizzare il gruppo compliance del tenant. |
| `phone_numbers` | `vapi_assistant_id` | Evitare di dover ricavare l’assistente da dati esterni. |
| `sms_messages` | `client_id`, `from_number`, `to_number`, `body`, `status`, `provider_message_id` | Audit e stato degli SMS. |
| `telnyx_events` | `event_id`, `client_id`, `event_type`, `payload`, `processed_at` | Idempotenza e diagnostica dei webhook. |

## Piano di completamento consigliato

La tranche successiva dovrebbe essere implementata in quattro fasi. Prima va esteso lo schema con ordine Telnyx, compliance, eventi e SMS. Poi va costruita la gestione server-side dei requirement group e dei documenti, mantenendo i file in Supabase Storage e inviando a Telnyx solo gli oggetti necessari. Successivamente va aggiunta la UI guidata nell’onboarding cliente. Infine vanno completati webhook, retry, idempotenza e aggiornamento realtime dello stato.

Il flusso consigliato è il seguente:

1. Creazione del cliente e raccolta dei dati fiscali.
2. Upload dei documenti in Storage con percorso isolato per `client_id`.
3. Creazione del requirement group Telnyx per `IT`, tipo di numero e azione `ordering`.
4. Compilazione dei requisiti e creazione dell’ordine con `requirement_group_id`.
5. Persistenza immediata di ordine, numero, stato compliance e messaging profile.
6. Ricezione del webhook Telnyx e aggiornamento idempotente dello stato.
7. Associazione del numero attivo al messaging profile.
8. Creazione o aggiornamento dell’assistente Vapi.
9. Importazione del numero in Vapi e binding dell’assistente.
10. Invio dell’SMS di conferma solo dopo l’esito operativo richiesto.

## Verdetto

Il progetto è **parzialmente pronto** per la gestione API di numeri e Vapi, ma non è ancora pronto per dichiarare completato l’onboarding automatico italiano. La parte più urgente è la compliance Telnyx, perché un ordine italiano senza requirement group compilato può restare bloccato o non essere conforme. La seconda priorità è correggere il parsing del payload Vapi e aggiungere idempotenza ai webhook. La terza priorità è implementare SMS e UI di stato nella dashboard.

Non sono state eseguite chiamate operative verso Telnyx o Vapi e non sono stati acquistati numeri, creati requirement group, inviati SMS o creati assistenti durante questa analisi.

## Riferimenti

[1]: https://developers.telnyx.com/docs/numbers/phone-numbers/number-orders "Telnyx Number Orders"

[2]: https://developers.telnyx.com/docs/numbers/phone-numbers/requirement-groups "Telnyx Requirement Groups"

[3]: https://developers.telnyx.com/docs/messaging/messages/messaging-profiles-overview "Telnyx Messaging Profiles Overview"

[4]: https://docs.vapi.ai/server-url/events "Vapi Server Events"
