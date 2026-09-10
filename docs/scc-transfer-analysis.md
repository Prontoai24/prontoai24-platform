# Analisi SCC per trasferimenti extra-UE

**Versione:** 10 settembre 2026  
**Uso:** documento interno per la due diligence dei clienti enterprise.  
**Avvertenza:** questa analisi è informativa e non sostituisce il parere di un legale o la verifica dei contratti effettivamente sottoscritti.

## Sintesi esecutiva

Le Standard Contractual Clauses (“SCC”) non sono automaticamente necessarie per ogni provider non europeo. Diventano normalmente necessarie quando dati personali sono trasferiti verso un paese privo di decisione di adeguatezza applicabile e non opera un diverso meccanismo valido, come il trasferimento verso un destinatario certificato ai sensi dell’EU-U.S. Data Privacy Framework (“DPF”), quando il DPF è applicabile al trasferimento concreto.

Per ProntoAI24, la verifica deve essere fatta a livello di **flusso** e non solo di fornitore. Occorre considerare almeno: provider e relativa entità contrattuale, paese del destinatario, tipo di dati, regione configurata, subprocessors, backup, supporto, log, antifrode e piano acquistato.

Nella maggior parte dei casi le SCC sono già incorporate nel DPA o in un data transfer addendum del provider. In questi casi non serve necessariamente un nuovo accordo SCC separato con il provider, ma ProntoAI24 deve conservare il DPA/addendum applicabile e verificare che copra il servizio utilizzato. Quando non esiste un DPA pubblico o il provider non conferma il meccanismo di trasferimento, è necessario richiedere un DPA firmabile, un transfer addendum o una conferma contrattuale equivalente prima di promettere il servizio a un cliente con requisiti UE stringenti.

## Criteri di classificazione

| Stato | Significato operativo |
|---|---|
| **SCC nel DPA / addendum** | Le fonti ufficiali indicano SCC o meccanismi equivalenti. Conservare la versione applicabile e verificare entità, moduli e allegati. |
| **DPF o SCC fallback** | Il provider può utilizzare il DPF quando applicabile; le SCC restano necessarie come meccanismo alternativo o per entità/trasferimenti non coperti. |
| **SCC da richiedere** | Non è stato trovato un DPA pubblico sufficiente oppure le fonti ufficiali dichiarano che il DPA è disponibile su richiesta. |
| **Non determinabile senza contratto** | Le informazioni pubbliche non consentono di stabilire il meccanismo per lo specifico piano, regione o subprocessor. |

## Matrice provider

| Provider | Valutazione SCC | Cosa deve fare ProntoAI24 |
|---|---|---|
| **Vercel** | Il DPA prevede il quadro contrattuale per i trasferimenti internazionali. Le SCC possono essere il meccanismo applicabile quando il DPF o un’adeguatezza non copre il destinatario. | Conservare il DPA della versione/piano utilizzato e verificare la lista subprocessors e le regioni effettive. Non promettere EU-only sulla sola base della regione di deploy. |
| **Supabase** | DPA pubblico con trasferimenti internazionali e garanzie contrattuali. Le SCC sono rilevanti per trasferimenti verso destinatari non coperti da adeguatezza o DPF. | Selezionare una regione primaria UE quando richiesto, ma verificare backup, log, supporto, Edge Functions e subprocessors. Conservare DPA e subprocessor list. |
| **Cloudflare R2** | Il Customer DPA disciplina i trasferimenti e le garanzie applicabili. Le SCC possono essere necessarie per entità o subprocessors fuori da paesi adeguati. | Configurare esplicitamente la giurisdizione R2 UE se richiesta e verificare l’uso dei servizi Cloudflare collegati. La sede USA del provider non determina da sola la localizzazione R2. |
| **Stripe** | DPA e Data Transfers Addendum documentano trasferimenti globali, DPF ove applicabile e SCC come garanzia alternativa. | Conservare DPA, Data Transfers Addendum e lista service providers. Verificare l’entità Stripe contraente del Cliente e il prodotto di pagamento utilizzato. |
| **Vapi** | DPA/Trust Center e termini prevedono garanzie per trasferimenti; per flussi non coperti da adeguatezza o DPF servono SCC o meccanismo equivalente. | Confermare regione e piano Vapi, inclusi subprocessors voce, autenticazione, trascrizione e registrazione. Richiedere conferma contrattuale per un impegno EU-only. |
| **Telnyx** | La documentazione ufficiale indica un DPA/SCC disponibile su richiesta e un Data Transfer Impact Assessment. | Richiedere e archiviare il DPA firmabile, gli eventuali SCC e la lista subprocessors prima di promettere residency UE. Separare storage, routing voce, SMS e inference. |
| **ElevenLabs** | DPA pubblico e clausole per trasferimenti internazionali; le SCC possono coprire trasferimenti non coperti da adeguatezza/DPF. | Per clienti regolati usare l’ambiente EU Enterprise quando disponibile, verificare Zero Retention e conservare DPA, subprocessor list e configurazione endpoint. |
| **OpenAI** | DPA pubblico e documentazione di data controls; SCC sono rilevanti per trasferimenti fuori EEA/CH non coperti da adeguatezza o DPF. | Usare endpoint/residency UE quando eleggibile e verificare modello, feature, abuse monitoring e retention. Conservare DPA e subprocessor list. |
| **Anthropic** | DPA pubblico con SCC e riferimenti EEA; per direct commercial storage la documentazione indica dati negli USA, salvo diverso accordo/configurazione. | Richiedere conferma del prodotto e del percorso dati. Se si usa un cloud partner UE, verificare il contratto del partner e non trattarlo automaticamente come residency del direct API. |
| **Resend** | DPA pubblico con SCC/garanzie di trasferimento; i dati account e messaggi sono documentati come conservati negli USA. | Informare il Cliente che l’invio dall’Irlanda non sposta lo storage nell’UE. Conservare DPA e lista subprocessors; offrire alternativa solo se tecnicamente e contrattualmente disponibile. |
| **Inngest** | DPA pubblico non individuato nella revisione; managed cloud documentato negli USA. | Richiedere DPA firmabile e SCC/transfer addendum. Senza conferma contrattuale, classificare il provider come trasferimento USA da valutare e non garantire residency UE. |
| **Firecrawl** | DPA pubblico non individuato; la policy documenta server/storage USA. | Richiedere DPA e SCC specifici. Considerare self-hosting in infrastruttura UE solo come architettura diversa, non come opzione managed cloud UE. |
| **Unstructured** | DPA pubblico con garanzie per trasferimenti; SaaS documentato USA, customer-hosted separato. | Conservare DPA e SCC applicabili. Per requisiti di localizzazione valutare deployment customer-hosted o conferma scritta del piano e del percorso dati. |
| **Sentry** | DPA pubblico con trasferimenti e storage US/EU; SCC rilevanti per trasferimenti a destinatari non adeguati. | Selezionare la regione Frankfurt per lo storage principale, configurare il DSN/regione corretto e verificare metadati, supporto e subprocessors. |
| **Langfuse** | DPA pubblico ClickHouse/Langfuse con regione selezionabile e garanzie di trasferimento. | Usare l’account EU in Irlanda per i trace, verificare disaster recovery e support processors USA/globali, e conservare DPA/subprocessor list. |

## Richiedere un accordo SCC specifico

Un accordo o addendum specifico deve essere richiesto quando ricorre almeno una delle seguenti condizioni:

1. il provider non pubblica un DPA o dichiara che il DPA è disponibile solo su richiesta;
2. il contratto applicabile non identifica chiaramente il meccanismo di trasferimento;
3. il provider non conferma che le SCC coprano l’entità contrattuale, il prodotto e i subprocessors effettivamente usati;
4. il Cliente richiede una regione UE o un impegno EU-only più ampio di quello offerto dalla documentazione standard;
5. il trasferimento riguarda categorie di dati o rischi che richiedono misure supplementari;
6. il provider usa un cloud partner, un subprocessor o una feature AI con percorso dati differente rispetto al prodotto principale.

## Documentazione da conservare

Per ogni provider devono essere archiviati il DPA vigente, il transfer addendum o le SCC, la lista subprocessors con data di revisione, il piano e la regione configurati, il registro dei flussi, le misure supplementari applicate e l’eventuale conferma scritta ottenuta dal provider.

## Decisione operativa per ProntoAI24

ProntoAI24 non dovrebbe dichiarare che l’intera piattaforma è “EU-only” senza un’analisi per servizio e per cliente. La formulazione prudente è: **“ProntoAI24 utilizza provider che offrono, per alcuni servizi e piani, regioni UE e meccanismi di trasferimento conformi al Capo V GDPR. La configurazione applicabile, inclusi eventuali SCC, viene verificata per il servizio e il piano richiesti dal cliente.”**

## Riferimenti ufficiali

[1]: https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en "European Commission Standard Contractual Clauses"
[2]: https://www.edpb.europa.eu/sme-data-protection-guide/transfers-personal-data-third-countries_en "EDPB Transfers of personal data to third countries"
[3]: https://www.dataprivacyframework.gov/ "EU-U.S. Data Privacy Framework"
[4]: https://vercel.com/legal/dpa "Vercel Data Processing Addendum"
[5]: https://supabase.com/legal/dpa "Supabase Data Processing Addendum"
[6]: https://www.cloudflare.com/cloudflare-customer-dpa/ "Cloudflare Customer DPA"
[7]: https://stripe.com/legal/dpa "Stripe Data Processing Agreement"
[8]: https://telnyx.com/data-transfer-impact-assessment "Telnyx Data Transfer Impact Assessment"
[9]: https://openai.com/policies/data-processing-addendum/ "OpenAI Data Processing Addendum"
[10]: https://www.anthropic.com/legal/data-processing-addendum "Anthropic Data Processing Addendum"
[11]: https://resend.com/legal/dpa "Resend Data Processing Agreement"
[12]: https://unstructured.io/data-processing-addendum "Unstructured Data Processing Addendum"
[13]: https://sentry.io/legal/dpa/ "Sentry Data Processing Addendum"
[14]: https://langfuse.com/security/dpa "Langfuse / ClickHouse Data Processing Addendum"
