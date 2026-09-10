# Registro interno DPA e data residency

**Versione:** 10 settembre 2026  
**Ambito:** fornitori utilizzati o previsti da ProntoAI24.  
**Uso:** documento operativo interno per due diligence clienti B2B. Deve essere riesaminato prima della firma di un contratto enterprise e almeno periodicamente.

> La disponibilità di un DPA pubblico non equivale all’accettazione automatica dei suoi termini da parte di ProntoAI24. Per i clienti regolati devono essere verificati anche il piano sottoscritto, la regione configurata, i subprocessors effettivamente coinvolti e le misure tecniche applicate.

## Registro

| Provider | Funzione | DPA ufficiale | Privacy / sicurezza | Subprocessors | Indicazione residency | Attenzione UE |
|---|---|---|---|---|---|---|
| Vercel | Hosting, edge e serverless | [DPA][1] | [Privacy][2] | [Trust Center][3] | USA/globale; regioni UE disponibili | La regione di deploy non garantisce EU-only per tutti i servizi |
| Supabase | PostgreSQL, Auth, Storage, Realtime | [DPA][4] | [Privacy][5] | [Subprocessor List][6] | Regione AWS primaria selezionabile, incluse regioni UE | Backup, log, Edge Functions e subprocessors richiedono valutazione separata |
| Cloudflare R2 | Object storage | [Customer DPA][7] | [Privacy][8] | [Cloudflare subprocessors][9] | Giurisdizione R2 UE documentata | La restrizione `eu` deve essere configurata esplicitamente |
| Stripe | Pagamenti e billing | [DPA][10] | [Privacy][11] | [Service Providers][12] | Trattamento globale; entità UE disponibili | Non è stata trovata una garanzia pubblica di storage EU-only |
| Vapi | Orchestrazione voce AI | [Trust Center / DPA][13] | [Privacy][14] | [Trust Center][15] | Regioni USA/UE selezionabili secondo piano | WorkOS e altri subprocessors possono trattare dati negli USA |
| Telnyx | Telefonia e SMS | DPA disponibile su richiesta; [DTIA][16] | [Privacy][17] | [Subprocessors][18] | USA default; Germania/Parigi disponibili per servizi supportati | Storage, inference e voce hanno garanzie diverse |
| ElevenLabs | Text-to-speech | [DPA][19] | [Privacy][20] | [Subprocessors][21] | USA default; EU isolated environment Enterprise | Residency dipende da piano, endpoint e retention |
| OpenAI | LLM ed embedding | [DPA][22] | [Privacy ROW][23] | [Subprocessor List][24] | API EU disponibile per scope eleggibile | Endpoint, modello e requisiti MAM/ZDR devono essere verificati |
| Anthropic | LLM alternativo | [DPA][25] | [Privacy][26] | [Trust Center subprocessors][27] | Direct commercial storage documentato negli USA; EU routing su cloud partner | Non confondere routing partner con storage diretto Anthropic |
| Resend | Email transazionali | [DPA][28] | [Privacy][29] | [Subprocessors][30] | Storage/account data negli USA; invio da Irlanda | La regione di invio non sposta lo storage nell’UE |
| Inngest | Job asincroni | DPA pubblico non trovato | [Privacy][31] | [Trust Center][32] | Managed cloud documentato su AWS USA | Self-hosting non equivale a opzione managed EU |
| Firecrawl | Crawling web | DPA pubblico non trovato; richiederlo al provider | [Privacy][33] | [Trust Center][34] | Server e storage USA | Self-hosting può cambiare il perimetro, ma non è EU cloud residency |
| Unstructured | Parsing documenti | [DPA][35] | [Privacy][36] | [Subprocessor List][37] | SaaS documentato USA | Customer-hosted può offrire controllo geografico; non è una residency managed EU |
| Sentry | Error tracking | [DPA][38] | [Privacy][39] | [Subprocessors][40] | USA o Francoforte selezionabile | EU region controlla lo storage principale, non ogni metadato/supporto |
| Langfuse | LLM tracing | [DPA][41] | [Privacy][42] | [Subprocessors][43] | USA, Irlanda o Giappone selezionabili | Support processors possono restare fuori dall’UE |

## Punti di attenzione per clienti con data residency UE

Per un cliente che richiede residenza UE, la configurazione minima deve includere una regione UE per Supabase, Cloudflare R2, Sentry, Langfuse e gli eventuali servizi AI che supportano regionalità. OpenAI, Vapi, Telnyx ed ElevenLabs richiedono una verifica puntuale di endpoint, piano e modello. Stripe, Resend, Inngest, Firecrawl e il managed cloud diretto di Anthropic non devono essere descritti come EU-only sulla base delle fonti pubbliche esaminate.

I webhook, i log applicativi, i dati di supporto, le metriche, i backup e i sistemi antifrode possono avere una geografia diversa dal database primario. Prima di promettere una residenza UE contrattuale è necessario produrre un inventario dei flussi e ottenere conferma scritta del provider quando la documentazione pubblica non è sufficiente.

## Riferimenti ufficiali

[1]: https://vercel.com/legal/dpa "Vercel Data Processing Addendum"
[2]: https://vercel.com/legal/privacy-notice "Vercel Privacy Notice"
[3]: https://security.vercel.com/ "Vercel Trust Center"
[4]: https://supabase.com/legal/dpa "Supabase Data Processing Addendum"
[5]: https://supabase.com/privacy "Supabase Privacy Policy"
[6]: https://supabase.com/legal/customer-resources/subprocessor-list "Supabase Subprocessor List"
[7]: https://www.cloudflare.com/cloudflare-customer-dpa/ "Cloudflare Customer DPA"
[8]: https://www.cloudflare.com/privacypolicy/ "Cloudflare Privacy Policy"
[9]: https://www.cloudflare.com/gdpr/subprocessors/cloudflare-services/ "Cloudflare Services Subprocessors"
[10]: https://stripe.com/legal/dpa "Stripe Data Processing Agreement"
[11]: https://stripe.com/privacy "Stripe Privacy Center"
[12]: https://stripe.com/legal/service-providers "Stripe Service Providers"
[13]: https://security.vapi.ai/?itemUid=9d2de954-cf19-4bd9-9636-afa8b7411d1e&source=click "Vapi DPA / Trust Center"
[14]: https://vapi.ai/privacy "Vapi Privacy Policy"
[15]: https://security.vapi.ai/ "Vapi Trust Center"
[16]: https://telnyx.com/data-transfer-impact-assessment "Telnyx Data Transfer Impact Assessment"
[17]: https://telnyx.com/privacy-policy "Telnyx Privacy Policy"
[18]: https://telnyx.com/legal/subprocessors "Telnyx Subprocessors"
[19]: https://elevenlabs.io/dpa "ElevenLabs DPA"
[20]: https://elevenlabs.io/privacy-policy "ElevenLabs Privacy Policy"
[21]: https://compliance.elevenlabs.io/subprocessors "ElevenLabs Subprocessors"
[22]: https://openai.com/policies/data-processing-addendum/ "OpenAI Data Processing Addendum"
[23]: https://openai.com/policies/row-privacy-policy/ "OpenAI ROW Privacy Policy"
[24]: https://openai.com/policies/sub-processor-list/ "OpenAI Subprocessor List"
[25]: https://www.anthropic.com/legal/data-processing-addendum "Anthropic Data Processing Addendum"
[26]: https://www.anthropic.com/legal/privacy "Anthropic Privacy Policy"
[27]: https://trust.anthropic.com/subprocessors "Anthropic Subprocessors"
[28]: https://resend.com/legal/dpa "Resend DPA"
[29]: https://resend.com/legal/privacy-policy "Resend Privacy Policy"
[30]: https://resend.com/legal/subprocessors "Resend Subprocessors"
[31]: https://www.inngest.com/privacy "Inngest Privacy Policy"
[32]: https://trust.inngest.com/subprocessors "Inngest Subprocessors"
[33]: https://www.firecrawl.dev/privacy-policy "Firecrawl Privacy Policy"
[34]: https://trust.firecrawl.dev/subprocessors "Firecrawl Subprocessors"
[35]: https://unstructured.io/data-processing-addendum "Unstructured Data Processing Addendum"
[36]: https://unstructured.io/privacy-policy "Unstructured Privacy Policy"
[37]: https://unstructured.io/sub-processor-list "Unstructured Subprocessor List"
[38]: https://sentry.io/legal/dpa/ "Sentry Data Processing Addendum"
[39]: https://sentry.io/privacy/ "Sentry Privacy Policy"
[40]: https://sentry.io/legal/subprocessors/ "Sentry Subprocessors"
[41]: https://langfuse.com/security/dpa "Langfuse / ClickHouse DPA"
[42]: https://langfuse.com/privacy "Langfuse Privacy Policy"
[43]: https://langfuse.com/security/subprocessors "Langfuse Subprocessors"
