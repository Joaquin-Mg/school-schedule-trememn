import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isTeacher } from '@/lib/roles'

// POST /api/admin/registrar-no-shows
// Detecta reservas activas de la fecha indicada que NO fueron validadas
// y registra una penalización de 7 días por cada una.
// Body: { fecha?: string }  → YYYY-MM-DD, default: ayer en hora Chile
// Respuesta: { procesados: number, afectados: Array<{ email, reserva_id, suspendido_hasta }> }
export async function POST(request: Request) {
  const cookieStore = await cookies()

  // Cliente con anon key — solo para verificar sesión del profesor
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isTeacher(user.email)) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  // Leer fecha del body (opcional)
  let fecha: string | null = null
  try {
    const body = await request.json()
    fecha = body?.fecha ?? null
  } catch {
    // body vacío o no-JSON — se usa el default de la función SQL
  }

  // Validar formato YYYY-MM-DD si se proporcionó
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: 'Formato de fecha inválido. Usa YYYY-MM-DD.' }, { status: 400 })
  }

  // Cliente service_role para ejecutar la función SECURITY DEFINER
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Llamar a la función SQL que registra los no-shows
  const { data, error } = fecha
    ? await adminClient.rpc('registrar_no_shows', { fecha_objetivo: fecha })
    : await adminClient.rpc('registrar_no_shows')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const afectados = (data ?? []) as Array<{
    usuario_email: string
    reserva_id: string
    suspendido_hasta: string
  }>

  return NextResponse.json(
    { procesados: afectados.length, afectados },
    { status: 200 }
  )
}
