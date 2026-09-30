-- Migración 005: columna para espacios de acceso exclusivo a profesores
ALTER TABLE categorias_espacios
ADD COLUMN IF NOT EXISTS solo_profesores boolean NOT NULL DEFAULT false;

-- Marcar el Laboratorio como espacio restringido a profesores
UPDATE categorias_espacios
SET solo_profesores = true
WHERE nombre = 'Laboratorio';
