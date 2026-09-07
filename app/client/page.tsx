import Link from 'next/link'
import { ArrowUpRight, Bot, CalendarClock, FileText, Headphones, MessageCircle, PhoneCall, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import KnowledgeUpload from '@/components/KnowledgeUpload'

export const dynamic = 'force-dynamic'

export default async function DashboardClient() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: cliente } = await supabase
    .from('clients')
    .select('id, company_name, status, subscriptions(tier, minutes_package, minutes_used_current_period, current_period_end), call_logs(id, direction, duration_seconds, outcome, occurred_at), whatsapp_messages(id, direction, body, occurred_at), chatbot_conversations(id, messages_count, ai_resolutions, human_escalations, started_at), knowledge_documents(id, file_name, status, created_at)')
    .eq('profile_id', user.id)
    .single()

  const subscription = cliente?.subscriptions?.[0]
  const used = Number(subscription?.minutes_used_current_period ?? 0)
  const packageMinutes = Number(subscription?.minutes_package ?? 0)
  const remaining = Math.max(packageMinutes - used, 0)
  const calls = cliente?.call_logs ?? []
  const whatsapp = cliente?.whatsapp_messages ?? []
  const conversations = cliente?.chatbot_conversations ?? []
  const documents = cliente?.knowledge_documents ?? []
  const totalMessages = conversations.reduce((sum: number, item: any) => sum + Number(item.messages_count ?? 0), 0)
  const aiResolved = conversations.reduce((sum: number, item: any) => sum + Number(item.ai_resolutions ?? 0), 0)
  const metrics = [
    { Icon: PhoneCall, label: 'Minuti residui', value: packageMinutes ? `${remaining.toLocaleString('it-IT')} min` : '—', hint: 'Nel periodo corrente', color: 'bg-[#eaf0ff]' },
    { Icon: MessageCircle, label: 'Messaggi WhatsApp', value: whatsapp.length, hint: 'Conversazioni recenti', color: 'bg-[#e5f8f6]' },
    { Icon: Bot, label: 'Messaggi chatbot', value: totalMessages, hint: `${aiResolved} risolti dall’AI`, color: 'bg-[#f2f8d8]' },
    { Icon: CalendarClock, label: 'Rinnovo piano', value: subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('it-IT') : 'Da definire', hint: subscription?.tier ? `Piano ${subscription.tier}` : 'Nessun piano', color: 'bg-[#fff0dc]' },
  ]

  return (
    <main className="min-h-screen bg-[#f7fbff] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-white px-6 py-5 lg:px-10"><div className="mx-auto flex max-w-7xl items-center justify-between"><Link href="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--ink)] font-bold text-white">P</span><span className="font-bold">ProntoAI<span className="text-[var(--cyan)]">24</span> <span className="ml-2 hidden text-sm font-medium text-[var(--muted)] sm:inline">Client Portal</span></span></Link><span className="rounded-full bg-[#e5f8f6] px-3 py-1 text-xs font-bold text-[var(--blue)]">{cliente?.status || 'In setup'}</span></div></header>
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10"><p className="text-sm font-bold uppercase tracking-[.18em] text-[var(--blue)]">Area riservata</p><h1 className="mt-2 text-4xl font-bold">{cliente?.company_name || 'Il tuo spazio operativo'}</h1><p className="mt-3 text-[var(--muted)]">Una vista semplice su assistenti, conversazioni e automazioni.</p>
        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(({ Icon, label, value, hint, color }) => <div key={label} className="rounded-3xl border border-[var(--line)] bg-white p-6"><span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${color}`}><Icon size={19} /></span><p className="mt-6 text-sm font-semibold text-[var(--muted)]">{label}</p><p className="mt-1 text-2xl font-bold">{String(value)}</p><p className="mt-2 text-xs text-[var(--muted)]">{hint}</p></div>)}</section>
        <section className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_.85fr]"><div className="space-y-6"><div className="rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8"><div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold">Ultime chiamate</h2><p className="mt-1 text-sm text-[var(--muted)]">Storico assistente telefonico AI.</p></div><PhoneCall className="text-[var(--blue)]" size={22} /></div><div className="mt-6 grid gap-3">{calls.slice(0, 5).map((call: any) => <div key={call.id} className="flex items-center justify-between rounded-2xl bg-[#f7fbff] px-4 py-3 text-sm"><div><p className="font-bold">{call.direction === 'inbound' ? 'Chiamata ricevuta' : 'Chiamata effettuata'}</p><p className="mt-1 text-xs text-[var(--muted)]">{new Date(call.occurred_at).toLocaleString('it-IT')}</p></div><div className="text-right"><p className="font-bold">{Math.round(Number(call.duration_seconds) / 60)} min</p><p className="text-xs text-[var(--muted)]">{call.outcome || '—'}</p></div></div>)}{calls.length === 0 && <p className="py-8 text-center text-sm text-[var(--muted)]">Le chiamate appariranno qui quando il tuo assistente sarà attivo.</p>}</div></div><div className="rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8"><div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold">Knowledge Base</h2><p className="mt-1 text-sm text-[var(--muted)]">Documenti disponibili per gli assistenti.</p></div><FileText className="text-[var(--blue)]" size={22} /></div><div className="mt-6 grid gap-3">{documents.slice(0, 4).map((document: any) => <div key={document.id} className="flex items-center justify-between rounded-2xl border border-[var(--line)] px-4 py-3 text-sm"><span className="font-semibold">{document.file_name}</span><span className="text-xs font-bold text-[var(--blue)]">{document.status}</span></div>)}{documents.length === 0 && <p className="py-8 text-center text-sm text-[var(--muted)]">Nessun documento caricato.</p>}</div><KnowledgeUpload /></div></div><aside className="space-y-6"><div className="rounded-3xl bg-[var(--ink)] p-7 text-white"><ShieldCheck className="text-[var(--lime)]" size={24} /><h2 className="mt-5 text-2xl font-bold">Hai bisogno di aiuto?</h2><p className="mt-3 text-sm leading-6 text-white/65">Apri un ticket e il team ProntoAI24 seguirà la richiesta fino alla risoluzione.</p><Link href="/client/supporto" className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-bold text-[var(--ink)]">Apri un ticket <ArrowUpRight size={16} /></Link></div><div className="rounded-3xl border border-[var(--line)] bg-white p-7"><Headphones className="text-[var(--blue)]" size={23} /><h3 className="mt-5 text-xl font-bold">Supporto e upgrade</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Richiedi più minuti, un nuovo modulo AI o assistenza sul tuo setup.</p><a href="mailto:supporto@prontoai24.it" className="mt-5 inline-flex text-sm font-bold text-[var(--blue)]">Contatta il supporto <ArrowUpRight size={15} className="ml-2" /></a></div></aside></section>
      </div>
    </main>
  )
}
