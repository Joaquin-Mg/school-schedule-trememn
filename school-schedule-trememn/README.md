# Sistema de Reservas — Colegio Intercultural Trememn

Aplicación web para que estudiantes reserven espacios físicos del colegio (mesa de ping pong, cancha de fútbol, etc.) usando su correo institucional `@trememn.cl`.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Lenguaje:** TypeScript 5
- **Estilos:** Tailwind CSS 4
- **Base de datos / Auth:** Supabase (PostgreSQL + Auth)
- **Deploy:** Vercel

## Estructura del repositorio (monorepo)

```
school-schedule-trememn/          ← raíz del repositorio GitHub
├── node_modules/                 ← dependencias de la app (instaladas aquí)
├── package.json                  ← package.json RAÍZ (legacy — no usar para desarrollo)
├── package-lock.json             ← lock raíz (dependencias de la app)
└── school-schedule-trememn/     ← directorio raíz de la app Next.js (root de Vercel)
    ├── app/
    ├── lib/
    ├── public/
    ├── next.config.ts
    ├── package.json              ← package.json ACTIVO (versiones canónicas)
    ├── package-lock.json         ← lock del subdirectorio (Next, React, devDependencies)
    └── tsconfig.json
```

> **Importante:** Vercel hace el build desde `school-schedule-trememn/` (el subdirectorio).
> Las dependencias de la app (`@supabase`, `lucide-react`, `qrcode.react`, etc.) están instaladas
> en `node_modules/` de la **raíz del repo**, no en el subdirectorio.

## Desarrollo local

Correr desde la **raíz del repositorio**:

```bash
npm run dev
```

O bien, si usás el subdirectorio directamente:

```bash
cd school-schedule-trememn
npm install   # instala Next, React y devDependencies del subdirectorio
cd ..
npm install   # instala las dependencias de la app (@supabase, lucide-react, etc.)
npm run dev   # inicia el servidor desde la raíz
```

## Variables de entorno

Crear `.env.local` en la raíz del repositorio con:

```env
NEXT_PUBLIC_SUPABASE_URL=<url de tu proyecto Supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave anon de Supabase>
```

## Versiones instaladas

| Paquete | Versión |
|---|---|
| Next.js | 16.2.10 |
| React | 19.2.4 |
| TypeScript | 5.x |
| Tailwind CSS | 4.x |
| @supabase/ssr | 0.12.0 |
| @supabase/supabase-js | 2.110.1 |
