import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendTransactionalSms } from '@/lib/telnyx/sms'

export const dynamic = 'force-dynamic'

function verifySignature(rawBody: string, request: Request) {
  const publicKey = process.env.TELNYX_WEBHOOK_PUBLIC_KEY
  if (!publicKey) return true
  const signature = request.headers.get('telnyx-signature-ed25519') || request.headers.get('x-telnyx-signature-ed25519')
  const timestamp = request.headers.get('telnyx-timestamp') || request.headers.get('x-telnyx-timestamp')
  if (!signature || !timestamp) return false
  try { return crypto.verify(null, Buffer.from(`${timestamp}.${rawBody}`), publicKey, Buffer.from(signature, 'base64')) } catch { return false }
}

function complianceStatus(value: string) {
  const normalized = value.toLowerCase()
  if (['approved', 'active', 'success', 'completed'].some((item) => normalized.includes(item))) return 'approved'
  if (['rejected', 'declined', 'exception', 'failed', 'failure'].some((item) => normalized.includes(item))) return 'rejected'
  return 'pending'
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  if (!verifySignature(rawBody, request)) return NextResponse.json({ error: 'Firma webhook Telnyx non valida' }, { status: 401 })
  let payload: any
  try { payload = JSON.parse(rawBody) } catch { return NextResponse.json({ error: 'Payload JSON non valido' }, { status: 400 }) }

  const data = payload.data || payload
  const eventType = String(data.event_type || data.event || payload.event_type || payload.type || 'unknown')
  const eventPayload = data.payload || data
  const orderId = eventPayload.number_order_id || eventPayload.order_id || eventPayload.numberOrderId || (eventType.includes('number_order') ? data.id : null)
  const numberId = eventPayload.phone_number_id || eventPayload.telnyx_number_id || eventPayload.id
  const requirementGroupId = eventPayload.requirement_group_id || eventPayload.requirementGroupId || (eventType.includes('requirement_group') ? data.id : null)
  const status = String(eventPayload.status || eventPayload.phone_number_status || eventPayload.order_status || '')
  const admin = createAdminClient()

  if (eventType.includes('message') || eventType.includes('messaging')) {
    const messageId = eventPayload.id || eventPayload.message_id
    if (messageId) await admin.from('sms_messages').update({ status: status.toLowerCase().includes('deliver') ? 'delivered' : status.toLowerCase().includes('fail') ? 'failed' : 'sent', updated_at: new Date().toISOString() }).eq('provider_message_id', messageId)
  }

  const updates: Record<string, unknown> = { status_updated_at: new Date().toISOString() }
  if (orderId) updates.telnyx_order_id = orderId
  if (requirementGroupId) updates.requirement_group_id = requirementGroupId
  if (status) {
    updates.compliance_status = complianceStatus(status)
    updates.status = status.toLowerCase().includes('active') || status.toLowerCase().includes('approved') || status.toLowerCase().includes('success') ? 'active' : 'pending'
  }

  let query = admin.from('phone_numbers').update(updates)
  if (numberId) query = query.eq('telnyx_number_id', numberId)
  else if (orderId) query = query.eq('telnyx_order_id', orderId)
  else if (requirementGroupId) query = query.eq('requirement_group_id', requirementGroupId)
  else query = null as any
  if (query) await query

  if (status && (updates.status === 'active' || updates.compliance_status === 'approved')) {
    const lookup = admin.from('phone_numbers').select('client_id, phone_number').eq(numberId ? 'telnyx_number_id' : orderId ? 'telnyx_order_id' : 'requirement_group_id', numberId || orderId || requirementGroupId).limit(1).maybeSingle()
    const { data: assignedPhone } = await lookup
    if (assignedPhone?.client_id) {
      const { data: client } = await admin.from('clients').select('contact_phone, company_name').eq('id', assignedPhone.client_id).single()
      const smsText = `ProntoAI24: la numerazione ${assignedPhone.phone_number} di ${client?.company_name || 'la tua azienda'} è stata attivata.`
      if (client?.contact_phone) {
        const { data: alreadySent } = await admin.from('sms_messages').select('id').eq('client_id', assignedPhone.client_id).eq('to_number', client.contact_phone).eq('body', smsText).limit(1).maybeSingle()
        if (!alreadySent) {
          try { await sendTransactionalSms({ clientId: assignedPhone.client_id, toNumber: client.contact_phone, body: smsText }) } catch (error) { console.error('Telnyx activation SMS failed', error) }
        }
      }
    }
  }

  await admin.from('audit_logs').insert({ action: 'telnyx.webhook.received', entity_type: 'telnyx', entity_id: null, metadata: { eventType, orderId, numberId, requirementGroupId, status, eventId: payload.id || data.id || null } })
  return NextResponse.json({ received: true, eventType, orderId, numberId, requirementGroupId })
}
