-- Migración 003: corrección del bloque horario de almuerzo
-- Tarea D-2 del plan-bloque-d-trememn.md
--
-- Problema: existe un bloque con hora_inicio = '14:40' y hora_fin = '13:20',
-- valores invertidos e incorrectos. El horario real de almuerzo es 13:25–14:50.
--
-- INSTRUCCIONES: Aplicar manualmente en Supabase Dashboard → SQL Editor
-- luego verificar con: SELECT id, hora_inicio, hora_fin FROM bloques_horarios ORDER BY hora_inicio;

UPDATE bloques_horarios
SET
  hora_inicio = '13:25:00',
  hora_fin    = '14:50:00'
WHERE
  hora_inicio = '14:40:00'
  AND hora_fin = '13:20:00';
