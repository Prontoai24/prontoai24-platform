import Link from 'next/link'
import { ArrowRight, Bot, Check, ChevronDown, Clock3, Headphones, MessageSquareText, Network, PhoneCall, Sparkles, Workflow } from 'lucide-react'
import AccessModal from '@/components/AccessModal'

export const dynamic = 'force-dynamic'

const services = [
  { icon: PhoneCall, tag: 'Voce', title: 'Assistenti vocali AI', text: 'Rispondono, qualificano le richieste e fissano appuntamenti anche quando il team non è disponibile.', color: 'bg-[#dff7f5]' },
  { icon: MessageSquareText, tag: 'Conversazioni', title: 'Chatbot e assistenza', text: 'Un primo livello di supporto sempre attivo, addestrato sui contenuti e sui processi della tua azienda.', color: 'bg-[#eaf0ff]' },
  { icon: Workflow, tag: 'Processi', title: 'Automazioni operative', text: 'Colleghiamo strumenti e attività ripetitive per ridurre passaggi manuali e liberare tempo alle persone.', color: 'bg-[#f2f8d8]' },
  { icon: Network, tag: 'Integrazioni', title: 'Sistemi su misura', text: 'Progettiamo flussi AI che dialogano con CRM, email, agenda e applicativi già presenti.', color: 'bg-[#fff0dc]' },
]

const steps = [
  ['01', 'Ascoltiamo', 'Partiamo dagli obiettivi, dalle attività che assorbono più tempo e dalle opportunità concrete.'],
  ['02', 'Progettiamo', 'Disegniamo una soluzione proporzionata al tuo contesto, con priorità chiare e un percorso misurabile.'],
  ['03', 'Attiviamo', 'Mettiamo l’AI al lavoro, formiamo il team e restiamo al tuo fianco per farla evolvere.'],
]

export default function Home() {
  return (
    <main className="overflow-hidden">
      <section className="hero-glow grid-paper relative min-h-[720px] border-b border-[var(--line)]">
        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-7 lg:px-10">
          <Link href="/" className="flex items-center gap-3" aria-label="ProntoAI24 home">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--ink)] text-lg font-bold text-white shadow-lg shadow-[#102a43]/15">P</span>
            <span className="font-bold tracking-[-.04em] text-[var(--ink)]">ProntoAI<span className="text-[var(--cyan)]">24</span></span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-[var(--muted)] md:flex">
            <a href="#soluzioni" className="transition-colors hover:text-[var(--ink)]">Soluzioni</a>
            <a href="#metodo" className="transition-colors hover:text-[var(--ink)]">Metodo</a>
            <a href="#contatti" className="transition-colors hover:text-[var(--ink)]">Contatti</a>
          </nav>
          <AccessModal className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold text-[var(--ink)] backdrop-blur transition hover:border-[var(--cyan)]" />
        </header>

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-6 pb-24 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pb-32 lg:pt-24">
          <div className="reveal max-w-3xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#b7dce5] bg-white/65 px-4 py-2 text-xs font-bold uppercase tracking-[.16em] text-[var(--blue)] backdrop-blur"><Sparkles size={14} /> AI concreta, per aziende vere</div>
            <h1 className="max-w-3xl text-5xl font-bold leading-[.98] text-[var(--ink)] sm:text-6xl lg:text-[76px]">L’AI che fa <span className="text-[var(--blue)]">succedere</span> le cose.</h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-[var(--muted)]">Automazioni, assistenti e sistemi intelligenti progettati per aiutare il tuo business a lavorare meglio. Meno attività ripetitive. Più tempo per ciò che conta.</p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a href="#contatti" className="btn-primary inline-flex items-center justify-center gap-3 rounded-full bg-[var(--ink)] px-6 py-4 font-bold text-white">Richiedi una dimostrazione <ArrowRight size={18} /></a>
              <a href="#soluzioni" className="inline-flex items-center justify-center gap-3 rounded-full border border-[var(--line)] bg-white/65 px-6 py-4 font-bold text-[var(--ink)] backdrop-blur transition hover:border-[var(--cyan)]">Scopri le soluzioni <ChevronDown size={18} /></a>
            </div>
            <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3 text-sm font-semibold text-[var(--muted)]"><span className="flex items-center gap-2"><Check size={16} className="text-[var(--cyan)]" /> Progetti su misura</span><span className="flex items-center gap-2"><Check size={16} className="text-[var(--cyan)]" /> Supporto umano</span><span className="flex items-center gap-2"><Check size={16} className="text-[var(--cyan)]" /> Nessuna soluzione preconfezionata</span></div>
          </div>
          <div className="relative mx-auto h-[400px] w-full max-w-[500px] lg:h-[500px]">
            <div className="float absolute z-0 right-2 top-10 h-72 w-72 rounded-[42%] bg-[var(--cyan)]/20 blur-2xl" />
            <div className="float-delay absolute z-0 bottom-10 left-2 h-64 w-64 rounded-full bg-[var(--lime)]/35 blur-2xl" />
            <div className="absolute z-0 left-[12%] top-[11%] rotate-[-7deg] rounded-[30px] border border-white/70 bg-white/80 p-5 shadow-2xl shadow-[#0b6e9e]/15 backdrop-blur-xl sm:left-[15%] sm:w-[300px]">
              <div className="mb-10 flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e5f8f6] text-[var(--blue)]"><Bot size={21} /></span><span className="rounded-full bg-[#eff9d8] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#567318]">Attivo</span></div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--muted)]">Assistente AI</p><p className="mt-2 text-2xl font-bold">Pronto ad aiutare</p><div className="mt-6 h-2 overflow-hidden rounded-full bg-[#e5edf1]"><div className="h-full w-[78%] rounded-full bg-[var(--cyan)]" /></div><div className="mt-3 flex justify-between text-xs font-semibold text-[var(--muted)]"><span>Richieste gestite</span><span>78%</span></div>
            </div>
            <div className="float absolute z-0 bottom-[12%] right-[3%] w-[230px] rotate-[6deg] rounded-[26px] border border-white/70 bg-[var(--ink)] p-5 text-white shadow-2xl shadow-[#0b2e44]/25 sm:w-[260px]"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"><Clock3 size={17} className="text-[var(--lime)]" /></span><div><p className="text-xs text-white/60">Tempo recuperato</p><p className="mt-1 text-xl font-bold">Ogni settimana</p></div></div><p className="mt-5 text-sm leading-6 text-white/70">L’AI lavora in sottofondo. Il tuo team si concentra sulle decisioni.</p></div>
          </div>
        </div>
      </section>

      <section id="soluzioni" className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32"><div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[.18em] text-[var(--blue)]">Cosa facciamo</p><h2 className="mt-4 text-4xl font-bold sm:text-5xl">Dalla prima idea a un sistema che lavora davvero.</h2><p className="mt-6 text-lg leading-8 text-[var(--muted)]">Non vendiamo strumenti da configurare e dimenticare. Costruiamo soluzioni AI integrate nel modo in cui la tua azienda opera ogni giorno.</p></div><div className="mt-14 grid gap-5 md:grid-cols-2">{services.map(({ icon: Icon, tag, title, text, color }) => <article key={title} className="group rounded-[28px] border border-[var(--line)] bg-white p-7 transition duration-200 hover:-translate-y-1 hover:border-[#add7df] hover:shadow-xl hover:shadow-[#0b6e9e]/[.07] sm:p-9"><div className={`mb-16 flex h-12 w-12 items-center justify-center rounded-2xl ${color} text-[var(--ink)]`}><Icon size={23} /></div><p className="text-xs font-bold uppercase tracking-[.17em] text-[var(--blue)]">{tag}</p><h3 className="mt-3 text-2xl font-bold">{title}</h3><p className="mt-4 max-w-md leading-7 text-[var(--muted)]">{text}</p><span className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[var(--ink)] transition group-hover:gap-3">Approfondisci <ArrowRight size={16} className="text-[var(--cyan)]" /></span></article>)}</div></section>

      <section id="metodo" className="bg-[var(--ink)] px-6 py-24 text-white lg:px-10 lg:py-32"><div className="mx-auto max-w-7xl"><div className="grid gap-14 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-sm font-bold uppercase tracking-[.18em] text-[var(--lime)]">Il nostro metodo</p><h2 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">Tecnologia, ma senza complicazioni.</h2><p className="mt-6 max-w-md text-lg leading-8 text-white/65">Ogni progetto parte da un problema reale. Lo trasformiamo in un percorso chiaro, misurabile e sostenibile per il tuo team.</p></div><div className="grid gap-4">{steps.map(([number, title, text]) => <div key={number} className="grid gap-5 rounded-3xl border border-white/10 bg-white/[.05] p-6 sm:grid-cols-[70px_170px_1fr] sm:items-center"><span className="text-3xl font-bold text-[var(--lime)]">{number}</span><h3 className="text-xl font-bold">{title}</h3><p className="leading-7 text-white/60">{text}</p></div>)}</div></div></div></section>

      <section id="contatti" className="relative overflow-hidden px-6 py-24 lg:px-10 lg:py-32"><div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-[var(--lime)]/20 blur-3xl" /><div className="relative mx-auto grid max-w-7xl gap-10 rounded-[36px] bg-[var(--cyan)] px-7 py-12 sm:px-12 lg:grid-cols-[1fr_auto] lg:items-end lg:px-16 lg:py-16"><div><p className="text-sm font-bold uppercase tracking-[.18em] text-[var(--ink)]/65">Parliamone</p><h2 className="mt-4 max-w-2xl text-4xl font-bold text-[var(--ink)] sm:text-5xl">Hai un processo da migliorare?</h2><p className="mt-5 max-w-xl text-lg leading-8 text-[var(--ink)]/70">Raccontaci dove vuoi arrivare. Ti mostreremo come l’AI può aiutarti, partendo dal tuo contesto.</p></div><a href="mailto:ciao@prontoai24.it" className="btn-primary inline-flex items-center justify-center gap-3 rounded-full bg-[var(--ink)] px-6 py-4 font-bold text-white">Contattaci <ArrowRight size={18} /></a></div></section>

      <footer className="border-t border-[var(--line)] px-6 py-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col gap-5 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between"><div className="font-bold text-[var(--ink)]">ProntoAI<span className="text-[var(--cyan)]">24</span></div><p>Soluzioni AI e automazioni per il tuo business.</p><div className="flex items-center gap-5"><a href="mailto:ciao@prontoai24.it" className="hover:text-[var(--ink)]">Email</a><AccessModal className="font-semibold hover:text-[var(--ink)]" label="Area riservata" /></div></div></footer>
    </main>
  )
}
