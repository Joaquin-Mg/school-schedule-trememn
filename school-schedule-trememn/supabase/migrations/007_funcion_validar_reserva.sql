-- Migración 007: función pública para validar un QR sin exponer la tabla
-- Aplicar manualmente en Supabase Dashboard → SQL Editor ANTES de publicar el cambio de código
CREATE OR REPLACE FUNCTION validar_reserva(codigo text)
RETURNS TABLE (
  estado text,
  espacio text,
  fecha date,
  hora_inicio time,
  hora_fin time,
  alumno text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN r.status <> 'active' THEN 'cancelada'
      WHEN r.fecha <> (now() AT TIME ZONE 'America/Santiago')::date THEN 'otra_fecha'
      ELSE 'valida'
    END,
    e.nombre,
    r.fecha,
    b.hora_inicio,
    b.hora_fin,
    split_part(r.usuario_email, '@', 1)
  FROM reservas r
  JOIN categorias_espacios e ON e.id = r.espacio_id
  JOIN bloques_horarios b ON b.id = r.bloque_id
  WHERE r.codigo_qr_validador::text = codigo
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION validar_reserva(text) TO anon, authenticated;
