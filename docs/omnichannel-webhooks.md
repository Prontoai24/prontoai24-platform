# Test webhook WhatsApp e Web Chat

## Prerequisiti

Applicare prima la migration:

```text
supabase/migrations/0007_whatsapp_chat_channels.sql
```

Configurare `AI_WEBHOOK_SECRET` sul server e usare un `ORG_ID` esistente nella tabella `clients`. Non usare placeholder UUID se si vuole verificare la foreign key.

```bash
export BASE_URL="http://localhost:3000"
export WEBHOOK_SECRET="il-secret-configurato"
export ORG_ID="<client-uuid-esistente>"
```

## WhatsApp

Il payload è compatibile con una struttura Meta/WhatsApp semplificata. Il webhook risolve il tenant da `org_id`; in assenza di tale campo prova a mappare il numero destinatario in `phone_numbers.phone_number`.

```bash
curl -i -X POST "$BASE_URL/api/webhooks/ai/whatsapp" \
  -H "content-type: application/json" \
  -H "x-prontoai-webhook-secret: $WEBHOOK_SECRET" \
  --data @- <<JSON
{
  "org_id": "$ORG_ID",
  "type": "whatsapp.message",
  "conversation_id": "wa-test-conversation-001",
  "message": {
    "id": "wa-test-message-001",
    "from": "+393331112233",
    "to": "+390212345678",
    "type": "text",
    "text": { "body": "Vorrei informazioni sul piano Evoluto." },
    "timestamp": "2026-09-09T08:30:00.000Z"
  }
}
JSON
```

Risposta attesa:

```json
{
  "received": true,
  "org_id": "<client-uuid-esistente>",
  "conversation_id": "wa-test-conversation-001",
  "message_id": "wa-test-message-001"
}
```

## Web Chat

```bash
curl -i -X POST "$BASE_URL/api/webhooks/ai/webchat" \
  -H "content-type: application/json" \
  -H "x-prontoai-webhook-secret: $WEBHOOK_SECRET" \
  --data @- <<JSON
{
  "org_id": "$ORG_ID",
  "conversationId": "webchat-test-conversation-001",
  "message": {
    "id": "webchat-test-message-001",
    "sender": { "id": "visitor-001" },
    "text": "Avrei bisogno di parlare con un operatore.",
    "direction": "inbound",
    "created_at": "2026-09-09T08:31:00.000Z"
  }
}
JSON
```

Risposta attesa:

```json
{
  "received": true,
  "org_id": "<client-uuid-esistente>",
  "conversation_id": "webchat-test-conversation-001",
  "message_id": "webchat-test-message-001"
}
```

## Verifica Supabase

Dopo le chiamate, usare il client Supabase Admin o REST API in ambiente sicuro:

```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/conversations?select=id,org_id,conversation_id,channel,transcript&org_id=eq.$ORG_ID&conversation_id=in.(wa-test-conversation-001,webchat-test-conversation-001)" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/messages?select=id,org_id,conversation_id,provider,provider_message_id,body,status&org_id=eq.$ORG_ID&provider_message_id=in.(wa-test-message-001,webchat-test-message-001)" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Il server risponde `401` se il secret è errato, `200` con `ignored` se non riesce a risolvere il tenant, `200` con il riepilogo del messaggio se la persistenza è riuscita e `500` per errori infrastrutturali.

I messaggi duplicati, identificati da `provider` e `provider_message_id`, vengono ignorati con risposta `duplicate: true`.
