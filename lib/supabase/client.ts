import { createBrowserClient } from '@supabase/ssr'

// Usato nei Client Components (form di login, cambio password, dashboard interattive)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
