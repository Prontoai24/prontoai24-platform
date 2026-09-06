import { createClient } from '@/lib/supabase/server'

export default async function DashboardAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profilo } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user!.id)
    .single()

  // RLS filtra automaticamente: un admin vede solo i propri clienti,
  // il super_admin li vede tutti
  const { data: clienti } = await supabase
    .from('clients')
    .select('id, company_name, contact_email, status, subscriptions(tier, minutes_package, status)')
    .order('created_at', { ascending: false })

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Pannello Admin — ProntoAI24</h1>
      <p>Bentornato, {profilo?.full_name} ({profilo?.role})</p>

      {profilo?.role === 'super_admin' && (
        <p>
          <a href="/admin/gestione-admin">→ Gestione Admin</a>
        </p>
      )}

      <p>
        <a href="/admin/clienti/nuovo">+ Nuovo cliente</a>
      </p>

      <h2>Clienti ({clienti?.length ?? 0})</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
            <th>Azienda</th>
            <th>Email</th>
            <th>Piano</th>
            <th>Stato</th>
          </tr>
        </thead>
        <tbody>
          {clienti?.map((cliente: any) => (
            <tr key={cliente.id} style={{ borderBottom: '1px solid #eee' }}>
              <td>{cliente.company_name || '—'}</td>
              <td>{cliente.contact_email}</td>
              <td>
                {cliente.subscriptions?.[0]
                  ? `${cliente.subscriptions[0].tier} — ${cliente.subscriptions[0].minutes_package} min`
                  : 'Nessun piano'}
              </td>
              <td>{cliente.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
