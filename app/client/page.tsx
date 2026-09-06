import { createClient } from '@/lib/supabase/server'

export default async function DashboardClient() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: cliente } = await supabase
    .from('clients')
    .select('company_name, status, subscriptions(tier, minutes_package, minutes_used_current_period, current_period_end)')
    .eq('profile_id', user!.id)
    .single()

  const abbonamento = cliente?.subscriptions?.[0]
  const minutiResidui = abbonamento
    ? abbonamento.minutes_package - abbonamento.minutes_used_current_period
    : null

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Il tuo servizio ProntoAI24</h1>
      <p>{cliente?.company_name}</p>

      {abbonamento ? (
        <div style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8, maxWidth: 400 }}>
          <p><strong>Piano:</strong> {abbonamento.tier}</p>
          <p><strong>Pacchetto minuti:</strong> {abbonamento.minutes_package}</p>
          <p><strong>Minuti utilizzati:</strong> {abbonamento.minutes_used_current_period}</p>
          <p><strong>Minuti residui:</strong> {minutiResidui}</p>
          <p><strong>Rinnovo:</strong> {abbonamento.current_period_end}</p>
        </div>
      ) : (
        <p>Nessun piano attivo al momento.</p>
      )}
    </div>
  )
}
