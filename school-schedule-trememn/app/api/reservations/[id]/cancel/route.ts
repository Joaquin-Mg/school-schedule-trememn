import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  // Verificar sesión activa — getUser() valida contra el servidor Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Buscar la reserva y verificar que pertenece al usuario autenticado
  const { data: reserva, error: fetchError } = await supabase
    .from('reservas')
    .select('id, usuario_id, status')
    .eq('id', id)
    .single()

  if (fetchError || !reserva) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
  }

  if (reserva.usuario_id !== user.id) {
    return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
  }

  // Evitar cancelar algo que ya fue cancelado
  if (reserva.status === 'cancelled') {
    return NextResponse.json({ error: 'La reserva ya fue cancelada' }, { status: 409 })
  }

  // Cancelación lógica — no eliminar físicamente para preservar historial
  const { error: updateError } = await supabase
    .from('reservas')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
