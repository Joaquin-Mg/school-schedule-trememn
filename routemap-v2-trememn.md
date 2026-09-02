# Route map v2 — Sistema de reservas Colegio Trememn
> Generado desde código fuente · master `0c1fb82` · 26 agosto 2026
> Refleja el estado real del repositorio tras completar el Bloque Urgente (A-1 a C-3).

---

## Metadatos del proyecto

| Campo | Valor |
|---|---|
| Repositorio | https://github.com/Joaquin-Mg/school-schedule-trememn |
| Deploy | https://school-schedule-trememn.vercel.app |
| Framework | Next.js 16.2.10 (App Router) |
| Lenguaje | TypeScript 5.x |
| Estilos | Tailwind CSS 3.3 |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth (Magic Link OTP + contraseña para pruebas) |
| Rama principal | `master` |
| Estructura | Monorepo — app vive en `/school-schedule-trememn/` dentro del repo |
| Alias de imports | `@/*` → `/school-schedule-trememn/*` |

---

## Árbol de archivos relevantes

```
school-schedule-trememn/
├── middleware.ts                        ← Protección centralizada de rutas (A-1)
├── app/
│   ├── layout.tsx
│   ├── page.tsx                         ← Entry point: redirige a /dashboard o /login
│   ├── globals.css
│   ├── login/
│   │   └── page.tsx                     ← Pantalla de autenticación
│   ├── dashboard/
│   │   └── page.tsx                     ← SPA principal con 3 pestañas
│   ├── validar/
│   │   └── [id]/
│   │       └── page.tsx                 ← Validador QR (ruta pública)
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts                 ← Handler PKCE Magic Link
│   └── api/
│       └── reservations/
│           ├── route.ts                 ← POST: crear reserva (C-1, C-2, C-3)
│           └── [id]/
│               └── cancel/
│                   └── route.ts         ← PATCH: cancelar reserva (B-1)
├── lib/
│   └── supabase.ts                      ← createClient() browser
├── supabase/
│   └── migrations/
│       ├── 001_unique_reservation_constraint.sql  ← Unique index espacio+bloque+fecha (A-2)
│       └── 002_add_status_to_reservas.sql         ← Columna status en reservas (B-1)
└── package.json
```

---

## Mapa de rutas

| Ruta URL | Archivo fuente | Tipo | Acceso | Descripción |
|---|---|---|---|---|
| `/` | `app/page.tsx` | Page (client) | Público | Redirige a `/dashboard` o `/login` según sesión |
| `/login` | `app/login/page.tsx` | Page (client) | Público | Login con Magic Link OTP o contraseña (pruebas). Valida dominio `@trememn.cl` en cliente. |
| `/dashboard` | `app/dashboard/page.tsx` | Page (client) | Privado (middleware) | SPA principal con sidebar y 3 pestañas de contenido |
| `/dashboard` → pestaña `reservar` | `app/dashboard/page.tsx` | Vista interna | Privado | Selector de espacio + fecha + grilla de bloques. Llama a `POST /api/reservations`. |
| `/dashboard` → pestaña `mis_reservas` | `app/dashboard/page.tsx` | Vista interna | Privado | Reservas activas (fecha >= hoy) con QR y botón Cancelar |
| `/dashboard` → pestaña `historial` | `app/dashboard/page.tsx` | Vista interna | Privado | Reservas pasadas (fecha < hoy) en tabla |
| `/validar/[id]` | `app/validar/[id]/page.tsx` | Page (client) | **Público** | Validación de reserva por QR. Lookup por `codigo_qr_validador`. Muestra Autorizado/Denegado. |
| `/auth/callback` | `app/auth/callback/route.ts` | Route Handler (GET) | Público | Intercambia código PKCE por sesión activa. |
| `POST /api/reservations` | `app/api/reservations/route.ts` | API Route | Privado (sesión) | Crea reserva. Infiere `usuario_id`/`usuario_email` del token. Valida límite de 2 activas (C-2) y 1 por espacio/día (C-3). |
| `PATCH /api/reservations/[id]/cancel` | `app/api/reservations/[id]/cancel/route.ts` | API Route | Privado (sesión) | Cancela reserva propia (status → 'cancelled'). Verifica ownership. No elimina el registro. |

---

## Modelo de datos en Supabase

### Tabla: `reservas`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` PK | Identificador de la reserva |
| `usuario_id` | `uuid` FK → `auth.users.id` | Dueño de la reserva |
| `usuario_email` | `text` | Email del alumno (redundante para lectura en validador) |
| `espacio_id` | `uuid` FK → `categorias_espacios.id` | Espacio reservado |
| `bloque_id` | `uuid` FK → `bloques_horarios.id` | Bloque horario reservado |
| `fecha` | `date` | Fecha de la reserva (`YYYY-MM-DD`) |
| `codigo_qr_validador` | `text` / `uuid` | Token único para validación QR |
| `status` | `text` DEFAULT `'active'` | Estado: `active` \| `cancelled` — agregado en migración 002 |

**Constraints activos:**
- `unique_espacio_bloque_fecha` — UNIQUE(`espacio_id`, `bloque_id`, `fecha`) — migración 001

### Tabla: `categorias_espacios`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` PK | — |
| `nombre` | `text` | Nombre del espacio (ej: "Mesa de ping pong") |
| `descripcion` | `text` | Descripción del espacio |

**Espacios actualmente en BD (inferidos):**
- Mesa de ping pong
- Cancha de fútbol

**Espacios pendientes de agregar:**
- Cancha central
- Cancha de vóley
- Taca-taca
- Cúpula
- Laboratorio

### Tabla: `bloques_horarios`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` PK | — |
| `hora_inicio` | `time` | Hora de inicio del bloque |
| `hora_fin` | `time` | Hora de fin del bloque |

**Error conocido en datos:** existe un bloque con `hora_inicio = 14:40` / `hora_fin = 13:20` que debe ser corregido a `13:25` / `14:50` — ver tarea D-2.

---

## Lógica de negocio implementada (server-side)

| Regla | Dónde se valida | Fortaleza |
|---|---|---|
| Solo correos `@trememn.cl` | Cliente en `login/page.tsx` | Media — bypasseable por API directa |
| Máximo 2 reservas activas por alumno | `POST /api/reservations` (C-2) | Alta — server-side |
| Máximo 1 reserva por espacio/día | `POST /api/reservations` (C-3) | Alta — server-side |
| No doble reserva mismo slot | Constraint BD `unique_espacio_bloque_fecha` (A-2) | Alta — BD |
| Cancelación solo del dueño | `PATCH /api/reservations/[id]/cancel` (B-1) | Alta — server-side |
| Rutas privadas requieren sesión | `middleware.ts` (A-1) | Alta — middleware |

---

## Bugs conocidos (pendientes)

| ID | Severidad | Descripción | Resuelto en |
|---|---|---|---|
| BUG-03 | 🔴 Alta | `cancel/route.ts` usa API de cookies `get/set/remove` (deprecada en `@supabase/ssr`) en lugar de `getAll/setAll` — causa fallo de autenticación en cancelación en producción | D-1 |
| BUG-04 | 🟡 Media | Bloque de almuerzo tiene horario incorrecto en BD: `14:40–13:20` en lugar de `13:25–14:50` | D-2 |

---

## Estado de funcionalidades

| Funcionalidad | Estado | Observación |
|---|---|---|
| Login institucional | ✅ Implementado | Magic Link en producción |
| Protección de rutas | ✅ Implementado | Middleware centralizado (A-1) |
| Unique constraint reservas | ✅ Implementado | Migración 001 aplicada en Supabase |
| Crear reserva (server-side) | ✅ Implementado | API route con validaciones C-2 y C-3 |
| Ver reservas activas con QR | ✅ Implementado | — |
| Ver historial | ✅ Implementado | — |
| Cancelar reserva | ⚠️ Parcial | API route existe pero falla en producción por BUG-03 |
| Validar reserva por QR | ✅ Implementado | Ruta pública `/validar/[id]` |
| Modo profesor (sin límites) | ❌ No implementado | Requiere columna `rol` en BD y lógica en API |
| Espacios adicionales | ❌ No implementado | Requiere INSERT en `categorias_espacios` |
| Corrección horario almuerzo | ❌ Pendiente | Requiere UPDATE en `bloques_horarios` |
| Panel de administración | ❌ No implementado | — |
| Notificaciones por email | ❌ No implementado | Fase 1 del roadmap |
| Límite de reservas por alumno | ✅ Implementado | Default 2 (configurable via `MAX_ACTIVE_RESERVATIONS`) |

---

## Variables de entorno requeridas

| Variable | Entorno | Descripción |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` | Clave pública de Supabase |
| `MAX_ACTIVE_RESERVATIONS` | Vercel + `.env.local` | Límite de reservas activas (default: `2`; profesores: sin límite) |

---

## Observaciones técnicas para el agente

1. **`cancel/route.ts` usa API de cookies deprecada.** Usa `get/set/remove` en lugar de `getAll/setAll`. Esto impide que `createServerClient` lea correctamente las cookies en Edge Runtime de Vercel y provoca que `getUser()` devuelva `null`, resultando en 401. Corregir antes de cualquier otra tarea del Bloque D.

2. **No existe tabla `profiles` ni columna `rol`.** El modo profesor requiere crear esta estructura. La alternativa más simple (sin nueva tabla) es una lista de emails autorizados como variable de entorno; la solución correcta es una columna `rol` en la tabla `profiles` con RLS.

3. **Los espacios se cargan dinámicamente desde `categorias_espacios`.** Agregar nuevos espacios es solo un INSERT en Supabase — no requiere cambios de código.

4. **El historial no filtra por `status`.** Las reservas canceladas aparecen en el historial sin indicar que fueron canceladas. Pendiente mostrar badge "Cancelado" vs "Completado".

5. **`actualizarReservas` no filtra por `status = 'active'` en el cliente.** Las reservas canceladas siguen apareciendo en "Mis Reservas Activas" hasta que el usuario recarga la página, si la cancelación falla silenciosamente.
