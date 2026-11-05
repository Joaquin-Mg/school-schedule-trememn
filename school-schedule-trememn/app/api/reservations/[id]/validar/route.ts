import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// PATCH /api/reservations/[id]/validar
// Marca una reserva como validado=true usando el codigo_qr_validador.
// No requiere sesión — el inspector escanea el QR sin estar logueado.
// El "id" del path es el codigo_qr_validador (UUID único por reserva).
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: codigoQr } = await params

  if (!codigoQr) {
    return NextResponse.json({ error: 'Código QR inválido' }, { status: 400 })
  }

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

  // Marcar validado=true solo si la reserva está activa y el código coincide
  const { data, error } = await supabase
    .from('reservas')
    .update({ validado: true })
    .eq('codigo_qr_validador', codigoQr)
    .eq('status', 'active')
    .select('id, validado')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    // La reserva no existe, está cancelada o el código no coincide — no es un error grave
    return NextResponse.json({ ok: false, message: 'Reserva no encontrada o ya cancelada' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, id: data.id }, { status: 200 })
}
