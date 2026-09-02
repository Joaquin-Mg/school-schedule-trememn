# Plan de tareas — Bloque D
> Sistema de reservas Colegio Trememn · master `0c1fb82` · 2 septiembre 2026
> Continuación directa del Bloque Urgente (A–C). Cuatro tareas atómicas con criterios de aceptación verificables.

---

## Contexto

El Bloque Urgente quedó completo y mergeado a master. Las migraciones 001 y 002 fueron aplicadas manualmente en Supabase. El backfill de `status = 'active'` fue ejecutado.

Quedan cuatro problemas confirmados para resolver en este bloque:

| ID | Tipo | Descripción |
|---|---|---|
| D-1 | 🔴 Bug crítico | `cancel/route.ts` usa cookies `get/set/remove` deprecadas → 401 en producción |
| D-2 | 🟡 Bug de datos | Bloque de almuerzo con horario incorrecto en BD (`14:40–13:20` → `13:25–14:50`) |
| D-3 | ✨ Feature | Agregar 5 nuevos espacios reservables en BD |
| D-4 | ✨ Feature | Modo profesor: sin límites de reserva, acceso a espacios restringidos, gated por email |

---

## Orden de ejecución

```
D-1 (bug cancelación)  →  D-2 (datos almuerzo)  →  D-3 (espacios nuevos)  →  D-4 (modo profesor)
```

D-1 primero porque bloquea una funcionalidad ya implementada. D-2 y D-3 son cambios en BD sin dependencias de código. D-4 depende de D-3 (necesita los espacios restringidos creados antes de asignarles permisos).

---

## D-1 · Fix BUG-03 — API de cancelación retorna 401 en producción

**Rama sugerida:** `fix/cancel-cookie-api`

**Causa raíz confirmada:**
`app/api/reservations/[id]/cancel/route.ts` usa la API de cookies individual (`get/set/remove`) de `@supabase/ssr`, que está deprecada en versiones ≥ 0.5.0 y no funciona correctamente en el Edge Runtime de Vercel. El `createServerClient` no puede leer las cookies de sesión, `getUser()` devuelve `null`, y la ruta retorna 401.

**Archivo a modificar:**
- `app/api/reservations/[id]/cancel/route.ts`

**Cambio requerido — reemplazar el bloque `cookies` completo:**

```ts
// ANTES (deprecado)
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

// DESPUÉS (correcto para @supabase/ssr 0.12.0)
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
```

También eliminar el import de `CookieOptions` si queda sin usar:
```ts
// ANTES
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// DESPUÉS
import { createServerClient } from '@supabase/ssr'
```

**Criterios de aceptación:**
- [ ] `PATCH /api/reservations/{id}/cancel` con sesión activa retorna `200 OK` en producción (Vercel).
- [ ] La tarjeta de reserva desaparece del dashboard al cancelar, sin recargar la página.
- [ ] `PATCH /api/reservations/{id}/cancel` sin sesión sigue retornando `401`.
- [ ] En Supabase Dashboard, la reserva cancelada tiene `status = 'cancelled'` (no fue eliminada).

**Cómo testear:**
1. Crear una reserva desde el dashboard.
2. Ir a "Mis Reservas Activas" → hacer clic en "Cancelar reserva".
3. Confirmar el dialog → la tarjeta debe desaparecer.
4. Verificar en Supabase Dashboard que el registro existe con `status = 'cancelled'`.

---

## D-2 · Fix horario de almuerzo en BD

**Tipo:** cambio de datos (SQL directo en Supabase) — sin cambios de código.

**Problema confirmado:**
Existe un bloque horario con `hora_inicio = '14:40'` y `hora_fin = '13:20'`, valores invertidos e incorrectos. El horario real de almuerzo es `13:25–14:50`.

**SQL a ejecutar en Supabase Dashboard → SQL Editor:**

```sql
UPDATE bloques_horarios
SET
  hora_inicio = '13:25:00',
  hora_fin    = '14:50:00'
WHERE
  hora_inicio = '14:40:00'
  AND hora_fin = '13:20:00';
```

Verificar el resultado:
```sql
SELECT id, hora_inicio, hora_fin FROM bloques_horarios ORDER BY hora_inicio;
```

**Archivo a crear (para trazabilidad):**
- `supabase/migrations/003_fix_horario_almuerzo.sql`

```sql
-- Migración 003: corrección del bloque horario de almuerzo
-- Horario incorrecto: 14:40–13:20 (invertido)
-- Horario correcto:   13:25–14:50
UPDATE bloques_horarios
SET
  hora_inicio = '13:25:00',
  hora_fin    = '14:50:00'
WHERE
  hora_inicio = '14:40:00'
  AND hora_fin = '13:20:00';
```

**Criterios de aceptación:**
- [ ] En el dashboard, el bloque de almuerzo muestra `13:25 - 14:50`.
- [ ] No existe ningún bloque con `hora_inicio = '14:40'` en la tabla.
- [ ] El orden de bloques en la UI sigue siendo cronológico (la migración no altera el `id`).

---

## D-3 · Agregar nuevos espacios reservables en BD

**Tipo:** cambio de datos (SQL directo en Supabase) — sin cambios de código.

**Espacios a agregar:**

| Nombre | Descripción | Restringido a profesores |
|---|---|---|
| Cancha central | Cancha multideporte principal del establecimiento | No |
| Cancha de vóley | Cancha de vóleibol techada | No |
| Taca-taca | Mesa de taca-taca del patio central | No |
| Cúpula | Espacio cubierto multipropósito | No |
| Laboratorio | Laboratorio de ciencias — requiere supervisión docente | **Sí** |

**SQL a ejecutar en Supabase Dashboard → SQL Editor:**

```sql
INSERT INTO categorias_espacios (nombre, descripcion) VALUES
  ('Cancha central',   'Cancha multideporte principal del establecimiento'),
  ('Cancha de vóley',  'Cancha de vóleibol techada'),
  ('Taca-taca',        'Mesa de taca-taca del patio central'),
  ('Cúpula',           'Espacio cubierto multipropósito'),
  ('Laboratorio',      'Laboratorio de ciencias — requiere supervisión docente');
```

**Nota importante para D-4:** El `id` UUID del Laboratorio generado por este INSERT será necesario para definir qué espacios son de acceso exclusivo a profesores. Anotar el UUID resultante o usar el nombre como referencia en la variable de entorno de D-4.

**Archivo a crear (para trazabilidad):**
- `supabase/migrations/004_nuevos_espacios.sql`

```sql
-- Migración 004: agregar nuevos espacios reservables
INSERT INTO categorias_espacios (nombre, descripcion) VALUES
  ('Cancha central',   'Cancha multideporte principal del establecimiento'),
  ('Cancha de vóley',  'Cancha de vóleibol techada'),
  ('Taca-taca',        'Mesa de taca-taca del patio central'),
  ('Cúpula',           'Espacio cubierto multipropósito'),
  ('Laboratorio',      'Laboratorio de ciencias — requiere supervisión docente');
```

**Criterios de aceptación:**
- [ ] Los 5 espacios aparecen en el selector del dashboard al recargar.
- [ ] Se pueden crear reservas para cada uno de los nuevos espacios.
- [ ] No se alteraron ni duplicaron los espacios existentes (ping pong, cancha de fútbol).

---

## D-4 · Modo profesor

**Rama sugerida:** `feature/teacher-mode`

**Descripción:**
Los profesores tienen un conjunto de correos institucionales conocidos. Al autenticarse con uno de esos correos, el sistema debe:

1. No aplicar el límite de reservas activas (C-2 — actualmente hardcodeado a 2).
2. No aplicar el límite de 1 reserva por espacio/día (C-3).
3. Ver todos los espacios, incluyendo los marcados como restringidos (ej: Laboratorio).
4. Ver un badge "Profesor" en la navbar en lugar de "Alumno".

**Estrategia de implementación — sin nueva tabla:**
La lista de emails de profesores se define como variable de entorno `TEACHER_EMAILS` (lista separada por comas). Esta es la solución más simple y suficiente para el volumen actual del colegio. No requiere migración de BD.

```
TEACHER_EMAILS=profe1@trememn.cl,profe2@trememn.cl,direccion@trememn.cl
```

Para espacios restringidos, se agrega una columna `solo_profesores boolean DEFAULT false` a `categorias_espacios` y se marca el Laboratorio. El dashboard filtra los espacios según el rol del usuario.

---

### D-4a · Migración BD — columna `solo_profesores` en `categorias_espacios`

**Archivo a crear:** `supabase/migrations/005_espacios_solo_profesores.sql`

```sql
-- Migración 005: columna para espacios de acceso exclusivo a profesores
ALTER TABLE categorias_espacios
ADD COLUMN IF NOT EXISTS solo_profesores boolean NOT NULL DEFAULT false;

-- Marcar el Laboratorio como espacio restringido
UPDATE categorias_espacios
SET solo_profesores = true
WHERE nombre = 'Laboratorio';
```

**Aplicar manualmente en Supabase Dashboard → SQL Editor.**

---

### D-4b · Variable de entorno

Agregar en Vercel (Settings → Environment Variables) y en `.env.local`:

```
TEACHER_EMAILS=email1@trememn.cl,email2@trememn.cl
```

---

### D-4c · Helper `isTeacher()` en el servidor

**Archivo a crear:** `lib/roles.ts`

```ts
// lib/roles.ts
export function isTeacher(email: string | undefined): boolean {
  if (!email) return false
  const teacherEmails = (process.env.TEACHER_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
  return teacherEmails.includes(email.toLowerCase())
}
```

---

### D-4d · Modificar `POST /api/reservations` para saltarse límites si es profesor

**Archivo a modificar:** `app/api/reservations/route.ts`

Importar el helper y envolver las validaciones C-2 y C-3:

```ts
import { isTeacher } from '@/lib/roles'

// ... dentro del POST handler, después de verificar sesión:

const esProfesor = isTeacher(user.email)

// C-2: límite de reservas activas — omitir para profesores
if (!esProfesor) {
  const MAX = parseInt(process.env.MAX_ACTIVE_RESERVATIONS ?? '2')
  const { count } = await supabase
    .from('reservas')
    .select('*', { count: 'exact', head: true })
    .eq('usuario_id', user.id)
    .eq('status', 'active')
    .gte('fecha', new Date().toISOString().split('T')[0])

  if ((count ?? 0) >= MAX) {
    return NextResponse.json(
      { error: `Límite alcanzado: máximo ${MAX} reservas activas permitidas.` },
      { status: 422 }
    )
  }

  // C-3: límite de 1 reserva por espacio/día — omitir para profesores
  const { count: sameSpaceCount } = await supabase
    .from('reservas')
    .select('*', { count: 'exact', head: true })
    .eq('usuario_id', user.id)
    .eq('espacio_id', espacio_id)
    .eq('fecha', fecha)
    .eq('status', 'active')

  if ((sameSpaceCount ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Ya tienes una reserva para este espacio en la fecha seleccionada.' },
      { status: 422 }
    )
  }
}
```

---

### D-4e · Modificar `GET` de espacios para filtrar según rol

**Archivo a modificar:** `app/dashboard/page.tsx`

La carga de espacios actualmente hace `SELECT *` sin filtros. Pasar el rol del usuario al cliente y filtrar en la query del dashboard, o —mejor— crear un endpoint server-side que filtre:

```ts
// En cargarDatosIniciales, reemplazar la query de espacios:

const { data: { user } } = await supabase.auth.getUser()
// El email ya está disponible desde el estado del componente

// Cargar espacios: si es alumno, excluir los de solo_profesores
const query = supabase.from('categorias_espacios').select('*')
// El filtrado server-side se hace en el nuevo endpoint GET /api/spaces
const res = await fetch('/api/spaces')
const { espacios } = await res.json()
setEspacios(espacios)
```

**Archivo a crear:** `app/api/spaces/route.ts`

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isTeacher } from '@/lib/roles'

export async function GET() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const esProfesor = isTeacher(user.email)

  let query = supabase.from('categorias_espacios').select('*')
  if (!esProfesor) {
    query = query.eq('solo_profesores', false)
  }

  const { data: espacios, error } = await query.order('nombre')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ espacios, esProfesor })
}
```

---

### D-4f · Badge "Profesor" en navbar

**Archivo a modificar:** `app/dashboard/page.tsx`

Agregar estado `esProfesor` y ajustar el badge de la navbar:

```tsx
const [esProfesor, setEsProfesor] = useState(false)

// En cargarDatosIniciales, al llamar /api/spaces:
const res = await fetch('/api/spaces')
const json = await res.json()
setEspacios(json.espacios || [])
setEsProfesor(json.esProfesor || false)

// En la navbar, reemplazar el badge "Alumno":
<span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md font-medium hidden sm:inline-block">
  {esProfesor ? 'Profesor' : 'Alumno'}
</span>
```

---

### Criterios de aceptación — D-4 completo

- [ ] Un email en `TEACHER_EMAILS` puede crear más de 2 reservas activas sin recibir error 422.
- [ ] Un email en `TEACHER_EMAILS` puede reservar el mismo espacio más de una vez en el mismo día.
- [ ] Un email en `TEACHER_EMAILS` ve el Laboratorio en el selector de espacios.
- [ ] Un email de alumno normal **no** ve el Laboratorio en el selector.
- [ ] La navbar muestra "Profesor" para emails en `TEACHER_EMAILS` y "Alumno" para el resto.
- [ ] Un alumno sigue sin poder superar el límite de 2 reservas activas.

---

## Resumen de tareas y orden de ejecución

| Orden | ID | Tarea | Tipo | Rama | Acción manual en Supabase |
|---|---|---|---|---|---|
| 1 | D-1 | Fix cookies deprecadas en cancel/route.ts | Bug código | `fix/cancel-cookie-api` | — |
| 2 | D-2 | Corregir horario bloque almuerzo | Bug datos | — | SQL UPDATE + migration 003 |
| 3 | D-3 | Insertar 5 nuevos espacios | Feature datos | — | SQL INSERT + migration 004 |
| 4 | D-4a | Columna `solo_profesores` en BD | Migración | `feature/teacher-mode` | SQL ALTER + migration 005 |
| 5 | D-4b | Variable `TEACHER_EMAILS` en Vercel | Config | — | Vercel Dashboard |
| 6 | D-4c | Helper `lib/roles.ts` | Feature código | `feature/teacher-mode` | — |
| 7 | D-4d | Lógica profesor en `POST /api/reservations` | Feature código | `feature/teacher-mode` | — |
| 8 | D-4e | Nuevo endpoint `GET /api/spaces` | Feature código | `feature/teacher-mode` | — |
| 9 | D-4f | Badge profesor en navbar | Feature UI | `feature/teacher-mode` | — |

---

## Variables de entorno nuevas requeridas

| Variable | Dónde agregar | Descripción |
|---|---|---|
| `TEACHER_EMAILS` | Vercel + `.env.local` | Lista de emails de profesores separados por coma. Ej: `profe@trememn.cl,otro@trememn.cl` |

---

## Migraciones SQL pendientes de aplicar manualmente

| Archivo | Cuándo aplicar |
|---|---|
| `supabase/migrations/003_fix_horario_almuerzo.sql` | Al ejecutar D-2 |
| `supabase/migrations/004_nuevos_espacios.sql` | Al ejecutar D-3 |
| `supabase/migrations/005_espacios_solo_profesores.sql` | Al ejecutar D-4a, **después** de D-3 |
