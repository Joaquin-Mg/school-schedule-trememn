-- Migración 010: tabla de penalizaciones y columna validado en reservas

-- Columna que marca si el QR fue validado antes del cierre del bloque
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS validado boolean DEFAULT false;

-- Tabla de penalizaciones (un no-show = 7 días de suspensión)
CREATE TABLE IF NOT EXISTS penalizaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reserva_id      uuid NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
  fecha_infraccion date NOT NULL,
  suspendido_hasta date NOT NULL,          -- fecha_infraccion + 7 días
  activa          boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE penalizaciones ENABLE ROW LEVEL SECURITY;

-- El alumno puede ver sus propias penalizaciones
CREATE POLICY "penalizaciones: leer propias"
ON penalizaciones FOR SELECT
TO authenticated
USING (auth.uid() = usuario_id);

-- Solo service_role puede insertar (proceso admin / función SECURITY DEFINER)
CREATE POLICY "penalizaciones: insertar service_role"
ON penalizaciones FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "penalizaciones: actualizar service_role"
ON penalizaciones FOR UPDATE
TO service_role
USING (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- Función: registrar_no_shows(fecha_objetivo)
-- Detecta reservas activas de la fecha indicada que NO fueron validadas
-- e inserta una penalización por cada una.
-- Por defecto usa el día anterior en hora de Chile.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION registrar_no_shows(
  fecha_objetivo date DEFAULT (now() AT TIME ZONE 'America/Santiago')::date - 1
)
RETURNS TABLE (
  usuario_email text,
  reserva_id    uuid,
  suspendido_hasta date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dias_suspension int := 7;
BEGIN
  RETURN QUERY
  WITH nuevas AS (
    INSERT INTO penalizaciones (usuario_id, reserva_id, fecha_infraccion, suspendido_hasta)
    SELECT
      r.usuario_id,
      r.id,
      fecha_objetivo,
      fecha_objetivo + dias_suspension
    FROM reservas r
    WHERE r.fecha    = fecha_objetivo
      AND r.status   = 'active'
      AND r.validado = false
    ON CONFLICT DO NOTHING
    RETURNING penalizaciones.usuario_id, penalizaciones.reserva_id, penalizaciones.suspendido_hasta
  )
  SELECT
    u.email::text,
    n.reserva_id,
    n.suspendido_hasta
  FROM nuevas n
  JOIN auth.users u ON u.id = n.usuario_id;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_no_shows(date) TO service_role;
