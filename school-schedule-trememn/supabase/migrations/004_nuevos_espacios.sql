-- Migración 004: agregar nuevos espacios reservables
-- Fecha: 2026-09-12
-- Los espacios existentes (Mesa de ping pong, Cancha de fútbol) no se modifican.
-- El Laboratorio se marcará como solo_profesores=true en la migración 005.

INSERT INTO categorias_espacios (nombre, descripcion)
VALUES
  ('Cancha central',  'Cancha multideporte principal del establecimiento'),
  ('Cancha de vóley', 'Cancha de vóleibol techada'),
  ('Taca-taca',       'Mesa de taca-taca del patio central'),
  ('Cúpula',          'Espacio cubierto multipropósito'),
  ('Laboratorio',     'Laboratorio de ciencias — requiere supervisión docente');
