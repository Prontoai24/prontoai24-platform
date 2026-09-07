import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host')?.split(':')[0].toLowerCase() ?? ''
  const isAdminHost = hostname === 'admin.prontoai24.it' || hostname === 'admin.localhost'
  const isClientHost = hostname === 'client.prontoai24.it' || hostname === 'client.localhost'
  const isPublicHost = !isAdminHost && !isClientHost
  const originalPath = request.nextUrl.pathname
  const path = (isAdminHost || isClientHost) && originalPath === '/'
    ? (isAdminHost ? '/admin' : '/client')
    : originalPath

  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isAuthRoute = path.startsWith('/login') || path.startsWith('/client/login') || path.startsWith('/auth')

  // La home del dominio principale è pubblica; admin e client richiedono autenticazione.
  if (!user && !isAuthRoute && !isPublicHost) {
    const loginUrl = new URL(isClientHost ? '/client/login' : '/login', request.url)
    loginUrl.searchParams.set('next', isAdminHost ? '/admin' : '/client')
    return NextResponse.redirect(loginUrl)
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, must_change_password')
      .eq('id', user.id)
      .single()

    if (profile?.must_change_password === true && path !== '/auth/update-password') {
      return NextResponse.redirect(new URL('/auth/update-password', request.url))
    }

    // Isolamento per ruolo e per sottodominio.
    if ((path.startsWith('/admin') || isAdminHost) && profile?.role === 'client') {
      return NextResponse.redirect(new URL('/client', request.url))
    }
    if ((path.startsWith('/client') || isClientHost) && (profile?.role === 'admin' || profile?.role === 'super_admin')) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    if (path.startsWith('/admin/gestione-admin') && profile?.role !== 'super_admin') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    if (isAuthRoute && path !== '/auth/update-password') {
      const dest = profile?.role === 'client' ? '/client' : '/admin'
      return NextResponse.redirect(new URL(dest, request.url))
    }
  }

  // I sottodomini condividono la stessa app Vercel: la root viene riscritta
  // nel modulo corretto mantenendo invariato l'URL pubblico.
  if ((isAdminHost || isClientHost) && originalPath === '/') {
    const target = request.nextUrl.clone()
    target.pathname = path
    return NextResponse.rewrite(target, { request: { headers: request.headers }, headers: response.headers })
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/inngest).*)'],
}
