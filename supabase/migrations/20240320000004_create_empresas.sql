-- Crear la tabla empresas si no existe
CREATE TABLE IF NOT EXISTS empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_fiscal VARCHAR(255) NOT NULL,
    cif VARCHAR(20) NOT NULL,
    direccion TEXT,
    email_facturacion VARCHAR(255),
    telefono VARCHAR(20),
    created_by UUID REFERENCES auth.users(id) NOT NULL DEFAULT auth.uid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Añadir empresa_id a profiles si no existe
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_empresas_cif ON empresas(cif);
CREATE INDEX IF NOT EXISTS idx_profiles_empresa_id ON profiles(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empresas_created_by ON empresas(created_by);

-- Habilitar RLS para empresas
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para empresas
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

-- Trigger para actualizar updated_at
CREATE TRIGGER update_empresas_updated_at
    BEFORE UPDATE ON empresas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 