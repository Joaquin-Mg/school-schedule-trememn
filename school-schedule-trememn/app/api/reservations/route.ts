import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.delete({ name, ...options })
        },
      },
    }
  )

  // usuario_id siempre se infiere del token de sesión — nunca del body del cliente
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const { espacio_id, bloque_id, fecha } = body

  if (!espacio_id || !bloque_id || !fecha) {
    return NextResponse.json(
      { error: 'Faltan campos requeridos: espacio_id, bloque_id, fecha' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('reservas')
    .insert([
      {
        usuario_id: user.id,      // del token, nunca del cliente
        usuario_email: user.email, // del token, nunca del cliente
        espacio_id,
        bloque_id,
        fecha,
      },
    ])
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
