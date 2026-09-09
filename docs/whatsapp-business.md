# WhatsApp Business — ProntoAI24

## Raccomandazione per l’MVP

Per il primo rilascio è preferibile **Meta WhatsApp Cloud API diretta**. Evita il markup per messaggio di un BSP, mantiene il controllo sul WABA e si integra direttamente con i webhook Meta. Il costo e la complessità operativa aumentano però quando ProntoAI24 deve onboardare molti numeri di clienti: in quel caso un BSP con Embedded Signup può ridurre il lavoro di provisioning e supporto.

| Opzione | Vantaggi | Svantaggi | Quando usarla |
|---|---|---|---|
| Meta Cloud API | Nessun intermediario API; controllo diretto di WABA, template e token; costi Meta trasparenti | Verifica Business Manager, WABA, numero e webhook a carico del team; gestione onboarding multi-tenant più impegnativa | MVP e primi tenant |
| Twilio | Onboarding e strumenti maturi; webhook e sender self-sign-up; supporto operativo | Fee Twilio oltre alle tariffe Meta; astrazione ulteriore e lock-in | Team piccolo che privilegia velocità e supporto |
| 360dialog | API vicina a WhatsApp Cloud API; Embedded Signup e focus WhatsApp | Canone BSP; onboarding e supporto dipendono dal piano e dal partner | SaaS focalizzato su WhatsApp con molti numeri |

Le tariffe Meta sono dipendenti da mercato e categoria; i template devono essere approvati. Le conversazioni avviate dall’utente permettono risposte di servizio nella finestra prevista da WhatsApp, mentre i messaggi proattivi richiedono template approvati. Verificare sempre il listino corrente prima di definire il pricing cliente.

## Implementazione presente

Il progetto espone:

- `GET /api/webhooks/whatsapp` per la verifica `hub.verify_token` di Meta;
- `POST /api/webhooks/whatsapp` come endpoint pubblico Meta;
- delega a `/api/webhooks/ai/whatsapp`, che verifica `x-hub-signature-256`, risolve il tenant dal numero destinatario e salva i dati in `conversations` e `messages` con `channel='whatsapp'`;
- `POST /api/whatsapp/send`, endpoint autenticato che accoda un invio in Inngest;
- funzione Inngest `whatsapp/message.send.requested`, che invia tramite Graph API e persiste il messaggio outbound;
- configurazione tenant in `tenant_channel_settings.whatsapp_config`, con fallback alle variabili globali.

Il routing inbound usa il numero destinatario (`metadata.phone_number_id`/numero) e la tabella `phone_numbers`; in alternativa accetta `org_id` già risolto dal payload solo nel flusso interno/provider autorizzato.

## Configurazione Meta

1. Creare o selezionare un’app Meta Business con prodotto WhatsApp.
2. Creare/collegare il WABA e completare la verifica dell’azienda.
3. Aggiungere un numero business non già collegato a WhatsApp consumer/app, completare la verifica OTP e ottenere il `phone_number_id`.
4. Creare un token di sistema con permessi per messaggistica WhatsApp e assegnarlo alla WABA.
5. Configurare il callback URL:

   `https://prontoai24.it/api/webhooks/whatsapp`

   con il verify token impostato in `WHATSAPP_VERIFY_TOKEN`.
6. Sottoscrivere il campo `messages` del WABA.
7. Salvare almeno queste variabili server-side:

```env
WHATSAPP_PROVIDER=meta
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_APP_SECRET=...
WHATSAPP_GRAPH_API_VERSION=v23.0
```

Per un SaaS multi-tenant, usare preferibilmente `tenant_channel_settings.whatsapp_config` per token e phone number ID specifici del tenant; non esporre mai il token nel browser.

## Template iniziali

- `attivazione_prontoai24`: categoria utility, lingua italiana, testo: `Ciao {{1}}, il tuo assistente ProntoAI24 è ora attivo. Puoi iniziare a ricevere richieste su WhatsApp.`
- `chiamata_persa_prontoai24`: categoria utility, lingua italiana, testo: `Abbiamo registrato una chiamata persa da {{1}} alle {{2}}. Ti consigliamo di ricontattare il cliente.`

I nomi e i testi devono essere inviati a Meta per approvazione. Non includere promesse, contenuti sensibili o variabili non necessarie.

## Test senza costi

La verifica webhook può essere provata con:

```bash
curl -i 'https://prontoai24.it/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=12345'
```

Per simulare un POST in ambiente locale con fallback condiviso esplicitamente abilitato solo in test:

```bash
curl -i -X POST http://localhost:3000/api/webhooks/ai/whatsapp \
  -H 'content-type: application/json' \
  -H "x-prontoai-webhook-secret: $AI_WEBHOOK_SECRET" \
  -d '{"object":"whatsapp_business_account","entry":[{"changes":[{"value":{"metadata":{"display_phone_number":"+390000000000"},"messages":[{"from":"393331234567","id":"wamid.TEST-001","timestamp":"1730000000","type":"text","text":{"body":"Ciao"}}]}}]}]}'
```

Il primo messaggio reale non può essere dichiarato inviato/ricevuto finché Meta non ha fornito WABA, numero verificato, token e template/numero di test. Dopo la configurazione, l’endpoint autenticato di invio è:

```bash
curl -X POST https://prontoai24.it/api/whatsapp/send \
  -H 'content-type: application/json' \
  -H 'cookie: <sessione autenticata>' \
  -d '{"to":"393331234567","text":"Messaggio di test ProntoAI24"}'
```

## Fonti ufficiali

- [Meta WhatsApp Cloud API — Get Started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started)
- [Meta Webhooks](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview)
- [Meta Template fundamentals](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)
- [Meta pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp/api)
- [Twilio self sign-up](https://www.twilio.com/docs/whatsapp/self-sign-up)
- [360dialog Webhooks](https://docs.360dialog.com/docs/messaging/webhook)
- [360dialog Embedded Signup](https://docs.360dialog.com/docs/hub/embedded-signup)
