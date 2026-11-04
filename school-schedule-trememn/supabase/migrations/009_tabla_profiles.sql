-- Migración 009: tabla profiles con columna curso
CREATE TABLE IF NOT EXISTS profiles (
  id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email     text UNIQUE NOT NULL,
  curso     text,                    -- ej: "I°M", "II°A", NULL si no asignado
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Cada alumno lee solo su propio perfil
CREATE POLICY "profiles: leer propio"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Solo el servidor (service_role) puede insertar/actualizar cursos
-- Los alumnos no pueden modificar su propio curso
CREATE POLICY "profiles: insertar service_role"
ON profiles FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "profiles: actualizar service_role"
ON profiles FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Función que crea el perfil automáticamente al registrarse un nuevo usuario
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
