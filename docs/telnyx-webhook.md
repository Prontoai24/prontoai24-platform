# Webhook messaging Telnyx

## Endpoint inbound

Configurare in Telnyx il webhook messaging verso:

```text
https://[tuo-dominio]/api/webhooks/ai/telnyx
```

La route gestisce gli eventi `message.received`, `message.sent`, `message.delivered`, `message.failed` e `message.finalized`.

## Firma

Il server richiede la chiave pubblica Telnyx in:

```env
TELNYX_WEBHOOK_PUBLIC_KEY=...
```

Telnyx invia gli header:

```text
telnyx-signature-ed25519
telnyx-timestamp
```

La firma viene verificata sul valore:

```text
<timestamp>.<raw_request_body>
```

Le richieste senza firma, con timestamp oltre cinque minuti o con firma non valida ricevono HTTP `401`.

## Routing multi-tenant

Il numero destinatario (`data.payload.to[0].phone_number`) viene cercato in `phone_numbers.phone_number`. Il webhook non accetta `client_id` dal payload come fonte attendibile: il tenant viene risolto esclusivamente dal mapping server-side.

I messaggi vengono salvati in `sms_messages` con:

- `client_id` risolto dal numero Telnyx;
- numero mittente e destinatario;
- testo;
- stato;
- `provider_message_id`;
- eventuale errore provider.

Gli eventi duplicati vengono ignorati tramite `provider_message_id`.

## Endpoint esistente

`/api/webhooks/telnyx` resta dedicato agli eventi di provisioning, ordini numerici e compliance. Il nuovo endpoint `/api/webhooks/ai/telnyx` è dedicato ai messaggi SMS inbound e ai relativi stati.

## Test health check

```bash
curl -i https://[tuo-dominio]/api/webhooks/ai/telnyx
```

La risposta attesa è HTTP `200` con provider `telnyx`. Per simulare POST è necessario generare una firma Ed25519 usando la chiave privata del test; non disabilitare la validazione in produzione.
