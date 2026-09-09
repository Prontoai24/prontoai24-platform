'use client'

import { FormEvent, useMemo, useState } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'

type ChatMessage = {
  id: string
  body: string
  direction: 'inbound' | 'outbound'
}

type WebChatWidgetProps = {
  orgId: string
  publicKey?: string
  endpoint?: string
  title?: string
}

function makeId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `webchat-${Date.now()}`
}

export default function WebChatWidget({
  orgId,
  publicKey = process.env.NEXT_PUBLIC_WEBCHAT_PUBLIC_KEY,
  endpoint = '/api/webhooks/ai/webchat',
  title = 'Assistente ProntoAI24',
}: WebChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId] = useState(() => makeId())
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const headers = useMemo(() => ({
    'content-type': 'application/json',
    ...(publicKey ? { 'x-webchat-public-key': publicKey } : {}),
  }), [publicKey])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || sending) return

    const messageId = makeId()
    setSending(true)
    setError(null)
    setMessages((current) => [...current, { id: messageId, body: trimmed, direction: 'outbound' }])
    setBody('')

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          org_id: orgId,
          conversationId,
          message: {
            id: messageId,
            sender: 'webchat-visitor',
            text: trimmed,
            direction: 'inbound',
            created_at: new Date().toISOString(),
          },
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.ignored) throw new Error(result.error || result.ignored || 'Messaggio non inviato')
      if (result.reply) setMessages((current) => [...current, { id: `${messageId}-reply`, body: result.reply, direction: 'inbound' }])
    } catch (submitError) {
      setMessages((current) => current.filter((item) => item.id !== messageId))
      setError(submitError instanceof Error ? submitError.message : 'Messaggio non inviato')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {open && (
        <section className="fixed bottom-24 right-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-2xl sm:right-6" aria-label={title}>
          <header className="flex items-center justify-between bg-[var(--ink)] px-5 py-4 text-white">
            <div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs text-white/60">Ti rispondiamo appena possibile</p></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Chiudi chat" className="rounded-full p-2 hover:bg-white/10"><X size={18} /></button>
          </header>
          <div className="max-h-80 min-h-40 space-y-3 overflow-y-auto bg-[#f7fbff] p-4">
            {messages.length === 0 && <p className="rounded-2xl bg-white p-3 text-sm text-[var(--muted)]">Ciao, come possiamo aiutarti?</p>}
            {messages.map((message) => <p key={message.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.direction === 'outbound' ? 'ml-auto bg-[var(--blue)] text-white' : 'bg-white text-[var(--ink)]'}`}>{message.body}</p>)}
          </div>
          {error && <p role="alert" className="px-4 pt-3 text-xs font-semibold text-red-600">{error}</p>}
          <form onSubmit={submit} className="flex gap-2 border-t border-[var(--line)] bg-white p-3">
            <input value={body} onChange={(event) => setBody(event.target.value)} placeholder="Scrivi un messaggio..." aria-label="Messaggio" className="min-w-0 flex-1 rounded-2xl border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--blue)]" />
            <button type="submit" disabled={sending || !body.trim()} aria-label="Invia messaggio" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--blue)] text-white disabled:cursor-not-allowed disabled:opacity-40"><Send size={16} /></button>
          </form>
        </section>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Chiudi chat' : 'Apri chat'} className="fixed bottom-5 right-4 z-50 flex items-center gap-2 rounded-full bg-[var(--blue)] px-5 py-3 text-sm font-bold text-white shadow-xl transition hover:-translate-y-0.5 sm:right-6"><MessageCircle size={18} /> Chat</button>
    </>
  )
}
