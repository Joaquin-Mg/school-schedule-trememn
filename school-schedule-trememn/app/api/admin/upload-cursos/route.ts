import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isTeacher } from '@/lib/roles'

export async function POST(request: Request) {
  const cookieStore = await cookies()

  // Cliente con anon key (solo para verificar sesión)
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

  // Cliente con service_role para hacer upsert en profiles
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
  }

  const texto = await file.text()
  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean)

  if (lineas.length < 2) {
    return NextResponse.json({ error: 'El archivo está vacío o solo tiene encabezado' }, { status: 400 })
  }

  // Ignorar la primera línea (encabezado "email,curso")
  const filas = lineas.slice(1)

  let actualizados = 0
  const errores: string[] = []

  for (const fila of filas) {
    const partes = fila.split(',')
    if (partes.length < 2) {
      errores.push(`Fila mal formateada: "${fila}"`)
      continue
    }

    const email = partes[0].trim().toLowerCase()
    const curso = partes.slice(1).join(',').trim()  // por si el curso tuviera comas

    if (!email || !curso) {
      errores.push(`Fila incompleta: "${fila}"`)
      continue
    }

    // Buscar si el usuario existe en auth.users vía profiles
    const { data: perfil, error: buscarError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (buscarError) {
      errores.push(`Error buscando "${email}": ${buscarError.message}`)
      continue
    }

    if (!perfil) {
      errores.push(`Email no registrado: "${email}"`)
      continue
    }

    // Actualizar curso
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ curso })
      .eq('id', perfil.id)

    if (updateError) {
      errores.push(`Error actualizando "${email}": ${updateError.message}`)
    } else {
      actualizados++
    }
  }

  return NextResponse.json({ actualizados, errores }, { status: 200 })
}
