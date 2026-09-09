-- Migración 006: habilitar Row-Level Security en todas las tablas públicas
-- Aplicar manualmente en Supabase Dashboard → SQL Editor

-- ============================================================
-- Habilitar RLS
-- ============================================================
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_espacios ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloques_horarios ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLÍTICAS para "reservas"
-- ============================================================

-- Usuarios autenticados leen sus propias reservas
CREATE POLICY "reservas: leer propias"
ON reservas FOR SELECT
TO authenticated
USING (auth.uid() = usuario_id);

-- Ruta /validar/[id] necesita leer reservas sin sesión (por codigo_qr_validador)
CREATE POLICY "reservas: validación QR pública"
ON reservas FOR SELECT
TO anon
USING (true);

-- Solo el dueño puede insertar (el servidor infiere usuario_id del token)
CREATE POLICY "reservas: insertar autenticado"
ON reservas FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = usuario_id);

-- Solo el dueño puede actualizar su reserva (cancelación vía PATCH)
CREATE POLICY "reservas: actualizar propia"
ON reservas FOR UPDATE
TO authenticated
USING (auth.uid() = usuario_id)
WITH CHECK (auth.uid() = usuario_id);

-- ============================================================
-- POLÍTICAS para "categorias_espacios"
-- ============================================================

-- Lectura pública (necesaria para el dashboard y el validador)
CREATE POLICY "espacios: lectura pública"
ON categorias_espacios FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================================
-- POLÍTICAS para "bloques_horarios"
-- ============================================================

-- Lectura pública (necesaria para el selector de bloques)
CREATE POLICY "bloques: lectura pública"
ON bloques_horarios FOR SELECT
TO anon, authenticated
USING (true);
