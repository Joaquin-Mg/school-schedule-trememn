import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isTeacher } from '@/lib/roles'
import { CUPO_SEMANAL, CUPO_DIARIO, semanaDeUnaFecha } from '@/lib/cupos'

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

  const esProfesor = isTeacher(user.email)

  // ── F-6: Bloqueo por suspensión ───────────────────────────────────────────
  if (!esProfesor) {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })

    const { count: suspCount, error: suspError } = await supabase
      .from('penalizaciones')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', user.id)
      .eq('activa', true)
      .gte('suspendido_hasta', hoy)

    if (suspError) {
      return NextResponse.json({ error: 'Error al verificar estado de suspensión' }, { status: 500 })
    }

    if ((suspCount ?? 0) > 0) {
      // Leer la fecha exacta para el mensaje de error
      const { data: pen } = await supabase
        .from('penalizaciones')
        .select('suspendido_hasta')
        .eq('usuario_id', user.id)
        .eq('activa', true)
        .gte('suspendido_hasta', hoy)
        .order('suspendido_hasta', { ascending: false })
        .limit(1)
        .maybeSingle()

      return NextResponse.json(
        { error: `Tu cuenta está suspendida hasta el ${pen?.suspendido_hasta}. No puedes realizar reservas.` },
        { status: 403 }
      )
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  if (!esProfesor) {
    // ── C-2: Límite de reservas activas por alumno ────────────────────────────
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
    // ─────────────────────────────────────────────────────────────────────────

    // ── C-3: Máximo 1 reserva por tipo de espacio por día ────────────────────
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
    // ─────────────────────────────────────────────────────────────────────────

    // ── F-3: Cupos por nivel ──────────────────────────────────────────────────
    const { data: perfil } = await supabase
      .from('profiles')
      .select('curso')
      .eq('id', user.id)
      .maybeSingle()

    const curso = perfil?.curso ?? null

    if (curso) {
      // Obtener todos los IDs de alumnos del mismo curso
      const { data: companerosData, error: companerosError } = await supabase
        .from('profiles')
        .select('id')
        .eq('curso', curso)

      if (companerosError) {
        return NextResponse.json({ error: 'Error al verificar cupos del nivel' }, { status: 500 })
      }

      const companerosIds = (companerosData ?? []).map(p => p.id)

      if (companerosIds.length > 0) {
        const { inicio: inicioSemana, fin: finSemana } = semanaDeUnaFecha(fecha)

        // Reservas del mismo nivel en el mismo espacio esta semana
        const { count: semanalCount, error: semanalError } = await supabase
          .from('reservas')
          .select('id', { count: 'exact', head: true })
          .eq('espacio_id', espacio_id)
          .eq('status', 'active')
          .gte('fecha', inicioSemana)
          .lte('fecha', finSemana)
          .in('usuario_id', companerosIds)

        // Reservas del mismo nivel en el mismo espacio hoy
        const { count: diarioCount, error: diarioError } = await supabase
          .from('reservas')
          .select('id', { count: 'exact', head: true })
          .eq('espacio_id', espacio_id)
          .eq('fecha', fecha)
          .eq('status', 'active')
          .in('usuario_id', companerosIds)

        if (semanalError || diarioError) {
          return NextResponse.json({ error: 'Error al verificar cupos del nivel' }, { status: 500 })
        }

        if ((semanalCount ?? 0) >= CUPO_SEMANAL) {
          return NextResponse.json(
            { error: `Tu curso (${curso}) ya alcanzó el cupo semanal (${CUPO_SEMANAL}) para este espacio.` },
            { status: 422 }
          )
        }

        if ((diarioCount ?? 0) >= CUPO_DIARIO) {
          return NextResponse.json(
            { error: `Tu curso (${curso}) ya alcanzó el cupo diario (${CUPO_DIARIO}) para este espacio.` },
            { status: 422 }
          )
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────
  }

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
