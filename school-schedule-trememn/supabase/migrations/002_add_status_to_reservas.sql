-- Migración 002: Agregar columna status a la tabla reservas
-- Prerequisito para la funcionalidad de cancelación (B-1)
--
-- INSTRUCCIONES: Aplicar manualmente en Supabase Dashboard → SQL Editor
--
-- La columna status permite cancelación lógica de reservas sin eliminar el registro
-- (necesario para historial del alumno y sistema de reputación futuro T-09)

ALTER TABLE reservas
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Verificar que el constraint es correcto
-- Los valores posibles son: 'active', 'cancelled'
COMMENT ON COLUMN reservas.status IS 'Estado de la reserva: active | cancelled';
