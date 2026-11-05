import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isTeacher } from '@/lib/roles'

export async function GET(request: Request) {
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const esProfesor = isTeacher(user.email)

  // Los alumnos solo ven espacios con solo_profesores = false.
  // Los profesores ven todos.
  let query = supabase.from('categorias_espacios').select('*')
  if (!esProfesor) {
    query = query.eq('solo_profesores', false)
  }

  const { data: espacios, error } = await query.order('nombre')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── F-4: Disponibilidad de bloques por espacio y fecha ───────────────────
  // Si se reciben espacio_id y fecha como query params, devolver qué bloques
  // están ocupados y por qué curso (para mostrar "I°M — ocupado" en la grilla).
  const { searchParams } = new URL(request.url)
  const espacioId = searchParams.get('espacio_id')
  const fecha     = searchParams.get('fecha')

  let bloquesOcupados: {
    bloque_id: string
    ocupado_por_usuario_id: string
    es_propio: boolean
    curso_ocupante: string | null
  }[] = []

  if (espacioId && fecha) {
    // 1. Reservas activas para ese espacio y fecha
    const { data: reservasActivas, error: resError } = await supabase
      .from('reservas')
      .select('bloque_id, usuario_id')
      .eq('espacio_id', espacioId)
      .eq('fecha', fecha)
      .eq('status', 'active')

    if (!resError && reservasActivas && reservasActivas.length > 0) {
      // 2. Obtener cursos de los usuarios que tienen reservas
      const usuarioIds = [...new Set(reservasActivas.map((r: any) => r.usuario_id))]
      const { data: perfiles } = await supabase
        .from('profiles')
        .select('id, curso')
        .in('id', usuarioIds)

      // Mapa usuario_id → curso
      const cursoPorUsuario: Record<string, string | null> = {}
      for (const p of (perfiles ?? [])) {
        cursoPorUsuario[p.id] = p.curso ?? null
      }

      bloquesOcupados = reservasActivas.map((r: any) => ({
        bloque_id:               r.bloque_id,
        ocupado_por_usuario_id:  r.usuario_id,
        es_propio:               r.usuario_id === user.id,
        curso_ocupante:          cursoPorUsuario[r.usuario_id] ?? null,
      }))
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  return NextResponse.json({ espacios, esProfesor, bloquesOcupados })
}
