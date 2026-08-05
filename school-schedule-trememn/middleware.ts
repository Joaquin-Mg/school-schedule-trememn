import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
          // Propagar headers de cache-control que @supabase/ssr inyecta
          // cuando renueva tokens (Cache-Control: private, no-store, etc.)
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value)
          )
        },
      },
    }
  )

  // IMPORTANTE: siempre getUser(), nunca getSession() en el servidor.
  // getSession() no valida el JWT contra Supabase — es bypasseable.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Ruta privada sin sesión → redirigir a /login
  if (!user && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Sesión activa intentando entrar a /login → redirigir al dashboard
  if (user && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Interceptar todas las rutas EXCEPTO:
     * - _next/static  (assets compilados)
     * - _next/image   (optimización de imágenes)
     * - favicon.ico
     * - /validar/*    (ruta pública de validación QR)
     * - /auth/*       (callback de Magic Link)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|validar|auth).*)',
  ],
}
