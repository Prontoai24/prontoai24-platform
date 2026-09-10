import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, CheckCircle2, CircleAlert, ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

const processors = [
  { name: 'Vercel', function: 'Hosting, edge delivery e serverless runtime', location: 'USA / globale; regioni UE disponibili, senza garanzia UE-only per ogni servizio', eu: true, note: 'La regione di deploy non equivale automaticamente a residenza globale dei dati.' },
  { name: 'Supabase', function: 'Database PostgreSQL, Auth, Storage e Realtime', location: 'Regione AWS selezionata dal cliente; regioni UE disponibili', eu: true, note: 'La regione primaria può essere scelta in Irlanda, Parigi, Francoforte o Stoccolma.' },
  { name: 'Cloudflare R2', function: 'Object storage per file e registrazioni', location: 'Giurisdizione selezionabile; opzione UE documentata', eu: true, note: 'La restrizione di giurisdizione deve essere configurata esplicitamente.' },
  { name: 'Stripe', function: 'Pagamenti, fatturazione e Tax', location: 'Trattamento globale; entità USA e UE', eu: false, note: 'Non è stata identificata una garanzia pubblica di storage esclusivamente UE.' },
  { name: 'Vapi', function: 'Orchestrazione degli assistenti vocali AI', location: 'USA / regione UE selezionabile secondo piano e configurazione', eu: true, note: 'Alcuni subprocessors e servizi di supporto possono restare negli USA.' },
  { name: 'Telnyx', function: 'Telefonia, numeri, SMS e servizi voce', location: 'USA di default; Germania e Parigi disponibili per servizi supportati', eu: true, note: 'Storage, inference e routing voce possono avere garanzie diverse.' },
  { name: 'ElevenLabs', function: 'Text-to-speech e voci sintetiche', location: 'USA di default; ambiente EU isolato per Enterprise', eu: true, note: 'La residency EU dipende da piano, endpoint e modalità di retention.' },
  { name: 'OpenAI', function: 'Modelli linguistici ed embedding', location: 'USA e rete globale; data residency API UE disponibile per scope eleggibile', eu: true, note: 'L’opzione UE è soggetta a endpoint, modello e requisiti di eleggibilità.' },
  { name: 'Anthropic', function: 'Modelli linguistici alternativi', location: 'Storage diretto documentato negli USA; routing EU disponibile su cloud partner', eu: false, note: 'La configurazione applicabile deve essere verificata per prodotto e modello.' },
  { name: 'Resend', function: 'Invio email transazionali', location: 'USA per dati account e messaggi; invio da Irlanda disponibile', eu: false, note: 'Resend dichiara che la regione di invio non sposta lo storage nell’UE.' },
  { name: 'Inngest', function: 'Job asincroni, eventi e orchestrazione', location: 'AWS USA', eu: false, note: 'Non è stata trovata una regione UE pubblica per il managed cloud.' },
  { name: 'Firecrawl', function: 'Crawling e acquisizione contenuti web', location: 'USA', eu: false, note: 'La policy ufficiale indica server e storage negli Stati Uniti.' },
  { name: 'Unstructured', function: 'Parsing e trasformazione documenti', location: 'USA; deployment customer-hosted con geografia controllata dal cliente', eu: false, note: 'Non è stata trovata una residency EU managed pubblicamente documentata.' },
  { name: 'Sentry', function: 'Error tracking e performance monitoring', location: 'USA o Francoforte, Germania, selezionabile', eu: true, note: 'La regione UE controlla lo storage principale, non ogni metadato o supporto.' },
  { name: 'Langfuse', function: 'Tracing LLM, prompt e metriche AI', location: 'USA, Irlanda o Giappone; regione account selezionabile', eu: true, note: 'La regione EU è separata e non implica che ogni subprocessor operi nell’UE.' },
]

export default function SubprocessorPage() {
  return (
    <main className="min-h-screen bg-[var(--paper)]">
      <header className="border-b border-[var(--line)] bg-white/80 px-6 py-6 backdrop-blur lg:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-3" aria-label="Torna alla home ProntoAI24">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--ink)] text-lg font-bold text-white">P</span>
            <span className="font-bold tracking-[-.04em]">ProntoAI<span className="text-[var(--cyan)]">24</span></span>
          </Link>
          <Link href="/" className="hidden items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)] sm:flex"><ArrowLeft size={16} /> Torna al sito</Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-14 pt-20 lg:px-10 lg:pt-28">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[.18em] text-[var(--blue)]"><ShieldCheck size={17} /> Trasparenza e protezione dati</p>
          <h1 className="mt-5 text-5xl font-bold leading-[1.02] sm:text-6xl">Subprocessor e sedi di trattamento</h1>
          <p className="mt-7 text-lg leading-8 text-[var(--muted)]">Questa pagina descrive i fornitori terzi che ProntoAI24 può utilizzare per erogare hosting, comunicazioni, AI, osservabilità e servizi di pagamento. Le sedi indicate sono quelle documentate pubblicamente dai provider e possono dipendere dal piano, dalla regione selezionata e dal servizio utilizzato.</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-[#b7dce5] bg-[#eaf8fa] p-6"><p className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} className="text-[var(--blue)]" /> Opzioni UE disponibili</p><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Per alcuni servizi è possibile selezionare una regione europea. La configurazione deve essere verificata e attivata nell’account applicabile.</p></div>
          <div className="rounded-3xl border border-[#ead8bd] bg-[#fff8ec] p-6"><p className="flex items-center gap-2 font-bold"><CircleAlert size={18} className="text-[#a16a15]" /> Punto di attenzione</p><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Una sede societaria UE o un endpoint europeo non garantiscono da soli che tutti i dati, log, supporto e subprocessors restino nell’UE.</p></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24 lg:px-10">
        <div className="overflow-x-auto rounded-[28px] border border-[var(--line)] bg-white shadow-sm">
          <table className="min-w-[900px] w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--ink)] text-white"><tr><th className="px-5 py-4 font-bold">Fornitore</th><th className="px-5 py-4 font-bold">Funzione</th><th className="px-5 py-4 font-bold">Sede / trattamento documentato</th><th className="px-5 py-4 font-bold">Opzione UE</th><th className="px-5 py-4 font-bold">Nota</th></tr></thead>
            <tbody>{processors.map((processor) => <tr key={processor.name} className="border-t border-[var(--line)] align-top"><td className="px-5 py-5 font-bold text-[var(--ink)]">{processor.name}</td><td className="px-5 py-5 text-[var(--muted)]">{processor.function}</td><td className="px-5 py-5 text-[var(--muted)]">{processor.location}</td><td className="px-5 py-5">{processor.eu ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eff9d8] px-3 py-1 text-xs font-bold text-[#567318]"><CheckCircle2 size={14} /> Disponibile / parziale</span> : <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff0dc] px-3 py-1 text-xs font-bold text-[#925c0c]"><CircleAlert size={14} /> Non documentata</span>}</td><td className="px-5 py-5 text-[var(--muted)]">{processor.note}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="mt-6 text-sm leading-7 text-[var(--muted)]">Ultimo riesame: 10 settembre 2026. Per i link ufficiali ai DPA, alle privacy policy e alle liste subprocessors, consulta la documentazione interna di compliance. Per richieste enterprise o valutazioni di data residency, contatta ProntoAI24 prima dell’attivazione del servizio.</p>
        <a href="mailto:privacy@prontoai24.it" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-bold text-white">Richiedi informazioni privacy <ArrowUpRight size={16} /></a>
      </section>
    </main>
  )
}
