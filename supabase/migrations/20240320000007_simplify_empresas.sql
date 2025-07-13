-- Simplificar empresas: mover campos empresariales a profiles
-- Esto elimina la complejidad de manejar múltiples empresas por usuario

-- Agregar campos empresariales directamente a profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS nombre_fiscal VARCHAR(255),
ADD COLUMN IF NOT EXISTS cif VARCHAR(20),
ADD COLUMN IF NOT EXISTS direccion TEXT,
ADD COLUMN IF NOT EXISTS email_facturacion VARCHAR(255);

-- Migrar datos existentes de empresas a profiles (si existen)
UPDATE profiles 
SET 
  nombre_fiscal = e.nombre_fiscal,
  cif = e.cif,
  direccion = e.direccion,
  email_facturacion = e.email_facturacion
FROM empresas e
WHERE profiles.empresa_id = e.id;

-- Eliminar la referencia a empresas en profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS empresa_id;

-- Actualizar la tabla receipts para referenciar directamente al usuario
-- (ya lo hace con user_id, así que no necesita cambios)

-- Crear índice para el CIF
CREATE INDEX IF NOT EXISTS idx_profiles_cif ON profiles(cif);

-- Opcional: Si quieres mantener la tabla empresas para casos especiales,
-- puedes comentar las siguientes líneas. Si no, las elimina:
-- DROP TABLE IF EXISTS empresas CASCADE; 