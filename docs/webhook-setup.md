# Configurazione webhook WhatsApp Meta

## Endpoint di verifica

L’endpoint canonico per configurare Meta è:

```text
https://[tuo-dominio]/api/webhooks/ai/meta
```

Il progetto mantiene anche l’endpoint compatibile:

```text
https://[tuo-dominio]/api/webhooks/whatsapp
```

Entrambi gestiscono la verifica GET di Meta tramite i parametri `hub.mode`, `hub.verify_token` e `hub.challenge`. L’endpoint `/api/webhooks/ai/meta` viene instradato internamente al gestore WhatsApp multi-tenant.

## Valori da inserire in Meta App Dashboard

| Campo Meta | Valore |
|---|---|
| Callback URL | `https://[tuo-dominio]/api/webhooks/ai/meta` |
| Verify Token | Lo stesso valore configurato in `WHATSAPP_VERIFY_TOKEN` |

Il verify token è un segreto condiviso per la sola fase di handshake. Non usare il token di accesso Graph API come verify token.

Esempio locale:

```env
WHATSAPP_VERIFY_TOKEN=imposta-un-token-casuale-lungo
```

## Test della verifica

Con server locale attivo:

```bash
curl -i 'http://localhost:3000/api/webhooks/ai/meta?hub.mode=subscribe&hub.verify_token=imposta-un-token-casuale-lungo&hub.challenge=test-123'
```

Risultato atteso:

```text
HTTP/1.1 200 OK

test-123
```

Con token errato il risultato atteso è `403`.

## Ricezione messaggi

Per le richieste POST Meta deve essere usato l’header di firma previsto dalla configurazione dell’app, insieme a `WHATSAPP_APP_SECRET`:

```env
WHATSAPP_APP_SECRET=...
```

Il gestore verifica la firma HMAC prima di elaborare il payload. Dopo l’autenticazione, il tenant viene risolto tramite `phone_number_id` nella configurazione WhatsApp attiva del tenant; i messaggi vengono deduplicati e salvati in `conversations` e `messages`.

Meta deve essere configurato per sottoscrivere almeno il campo `messages` della WABA. Il callback deve rispondere rapidamente con HTTP 200; l’elaborazione applicativa e i job successivi sono gestiti dal backend.

## Note sicurezza

Il verify token e `WHATSAPP_APP_SECRET` devono essere configurati esclusivamente negli environment server-side. Non inserire questi valori in variabili `NEXT_PUBLIC_*`, nel frontend o nella documentazione pubblica. Il token di accesso Meta per ciascun tenant è gestito separatamente e cifrato dalla configurazione WhatsApp tenant.
