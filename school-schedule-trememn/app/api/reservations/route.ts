import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
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

  // ── C-2: Límite de reservas activas por alumno ──────────────────────────────
  const MAX = parseInt(process.env.MAX_ACTIVE_RESERVATIONS ?? '2')
  const todayStr = new Date().toISOString().split('T')[0]

  const { count, error: countError } = await supabase
    .from('reservas')
    .select('*', { count: 'exact', head: true })
    .eq('usuario_id', user.id)
    .eq('status', 'active')
    .gte('fecha', todayStr)

  if (countError) {
    return NextResponse.json({ error: 'Error al verificar límite de reservas' }, { status: 500 })
  }

  if ((count ?? 0) >= MAX) {
    return NextResponse.json(
      { error: `Límite alcanzado: máximo ${MAX} reservas activas permitidas. Cancela una existente para continuar.` },
      { status: 422 }
    )
  }
  // ───────────────────────────────────────────────────────────────────────────

  // ── C-3: Máximo 1 reserva por tipo de espacio por día ──────────────────────
  const { count: sameSpaceCount, error: sameSpaceError } = await supabase
    .from('reservas')
    .select('*', { count: 'exact', head: true })
    .eq('usuario_id', user.id)
    .eq('espacio_id', espacio_id)
    .eq('fecha', fecha)
    .eq('status', 'active')

  if (sameSpaceError) {
    return NextResponse.json({ error: 'Error al verificar disponibilidad del espacio' }, { status: 500 })
  }

  if ((sameSpaceCount ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Ya tienes una reserva para este espacio en la fecha seleccionada.' },
      { status: 422 }
    )
  }
  // ───────────────────────────────────────────────────────────────────────────

  const { data, error } = await supabase
    .from('reservas')
    .insert([
      {
        usuario_id: user.id,       // del token, nunca del cliente
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
