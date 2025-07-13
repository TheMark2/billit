-- Primero eliminamos las políticas existentes
DROP POLICY IF EXISTS "Usuarios pueden ver empresas a las que pertenecen" ON empresas;
DROP POLICY IF EXISTS "Usuarios pueden insertar empresas" ON empresas;
DROP POLICY IF EXISTS "Usuarios pueden actualizar empresas a las que pertenecen" ON empresas;
DROP POLICY IF EXISTS "Usuarios pueden eliminar empresas a las que pertenecen" ON empresas;

-- Agregamos la columna created_by
ALTER TABLE empresas
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Actualizamos los registros existentes para establecer created_by
UPDATE empresas e
SET created_by = (
    SELECT p.id
    FROM profiles p
    WHERE p.empresa_id = e.id
    LIMIT 1
)
WHERE created_by IS NULL;

-- Hacemos la columna NOT NULL después de actualizarla
ALTER TABLE empresas
ALTER COLUMN created_by SET NOT NULL,
ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Crear índice para created_by si no existe
CREATE INDEX IF NOT EXISTS idx_empresas_created_by ON empresas(created_by);

-- Recreamos las políticas RLS
CREATE POLICY "Usuarios pueden ver empresas a las que pertenecen"
    ON empresas FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.empresa_id = empresas.id
            AND profiles.id = auth.uid()
        )
        OR created_by = auth.uid()
    );

CREATE POLICY "Usuarios pueden insertar empresas si están autenticados"
    ON empresas FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios pueden actualizar empresas a las que pertenecen"
    ON empresas FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.empresa_id = empresas.id
            AND profiles.id = auth.uid()
        )
        OR created_by = auth.uid()
    );

CREATE POLICY "Usuarios pueden eliminar empresas a las que pertenecen"
    ON empresas FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.empresa_id = empresas.id
            AND profiles.id = auth.uid()
        )
        OR created_by = auth.uid()
    ); 