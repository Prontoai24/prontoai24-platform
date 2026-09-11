'use client'

import { useEffect, useRef, useState } from 'react'
import Vapi from '@vapi-ai/web'
import { Mic, MicOff, PhoneCall, PhoneOff, Radio } from 'lucide-react'

export default function VapiVoiceWidget({ assistantId }: { assistantId?: string | null }) {
  const vapiRef = useRef<any>(null)
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active' | 'ended'>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY
  const demoMode = !publicKey || !assistantId

  useEffect(() => () => { vapiRef.current?.stop?.() }, [])

  async function startCall() {
    setError(''); setTranscript(''); setStatus('connecting')
    if (demoMode) {
      setTimeout(() => { setStatus('active'); setTranscript('Modalità demo audio attiva: il microfono è pronto, senza avviare una chiamata reale.') }, 700)
      return
    }
    try {
      const VapiClient = Vapi as any
      const client = new VapiClient(publicKey)
      vapiRef.current = client
      client.on('call-start', () => setStatus('active'))
      client.on('call-end', () => setStatus('ended'))
      client.on('message', (message: any) => {
        if (message?.type === 'transcript' && message.transcript) setTranscript((current) => `${current}${current ? ' ' : ''}${message.transcript}`)
      })
      client.on('error', (event: any) => { setError(event?.message || 'Errore del servizio vocale'); setStatus('ended') })
      await client.start(assistantId)
    } catch (event) { setError(event instanceof Error ? event.message : 'Impossibile avviare il microfono'); setStatus('ended') }
  }

  function stopCall() { vapiRef.current?.stop?.(); setStatus('ended') }

  return <section className="rounded-3xl border border-[#b7dce5] bg-[#eaf8fa] p-6"><div className="flex items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[var(--blue)]"><Radio size={14} /> Assistente vocale</p><h2 className="mt-2 text-2xl font-bold">Prova la voce in tempo reale</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">Consenti l’accesso al microfono per avviare il widget Vapi. In assenza di configurazione pubblica viene usata una simulazione locale senza costi.</p></div><div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${status === 'active' ? 'bg-[#dff6d0] text-[#3e751a]' : 'bg-white text-[var(--blue)]'}`}><Mic size={21} /></div></div><div className="mt-5 flex flex-wrap items-center gap-3">{status === 'active' || status === 'connecting' ? <button onClick={stopCall} className="inline-flex items-center gap-2 rounded-full bg-[#b42318] px-5 py-3 text-sm font-bold text-white">{status === 'connecting' ? 'Connessione…' : 'Termina chiamata'} <PhoneOff size={16} /></button> : <button onClick={startCall} className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-bold text-white"><PhoneCall size={16} /> Avvia chiamata</button>}{status === 'active' && <span className="inline-flex items-center gap-2 text-sm font-bold text-[#3e751a]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#5a9d2c]" /> Audio attivo</span>}{status === 'ended' && <span className="text-sm font-semibold text-[var(--muted)]">Sessione terminata</span>}</div>{transcript && <div className="mt-5 rounded-2xl bg-white p-4 text-sm leading-6"><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Trascrizione test</p><p className="mt-2">{transcript}</p></div>}{error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}{demoMode && <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-[var(--muted)]"><MicOff size={14} /> Demo locale: nessun numero Telnyx e nessun costo Vapi.</p>}</section>
}
