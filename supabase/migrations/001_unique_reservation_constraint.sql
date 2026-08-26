-- Migración: prevención de doble reserva en el mismo espacio/bloque/fecha
-- Tarea A-2 del plan-urgente-trememn.md
--
-- Este constraint garantiza que no puedan existir dos reservas activas
-- para el mismo espacio (espacio_id), bloque horario (bloque_id) y fecha.
-- Si el INSERT viola esta regla, Supabase retorna error código 23505 (unique_violation),
-- que el frontend captura y muestra al usuario.
--
-- Importante: aplica a nivel de BD, independientemente de las validaciones del cliente.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'unique_espacio_bloque_fecha'
  ) THEN
    ALTER TABLE reservas
    ADD CONSTRAINT unique_espacio_bloque_fecha
    UNIQUE (espacio_id, bloque_id, fecha);
  END IF;
END;
$$;
