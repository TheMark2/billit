-- Crear tabla para credenciales de Odoo
CREATE TABLE odoo_credentials (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    url TEXT NOT NULL, -- URL de la instancia de Odoo
    database TEXT NOT NULL, -- Nombre de la base de datos
    username TEXT NOT NULL, -- Nombre de usuario
    password TEXT NOT NULL, -- Contraseña (debería estar encriptada en producción)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE odoo_credentials ENABLE ROW LEVEL SECURITY;

-- Crear políticas para que los usuarios solo puedan acceder a sus propias credenciales
CREATE POLICY "Users can view their own odoo credentials" ON odoo_credentials
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own odoo credentials" ON odoo_credentials
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own odoo credentials" ON odoo_credentials
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own odoo credentials" ON odoo_credentials
    FOR DELETE USING (auth.uid() = user_id);

-- Crear índice para mejorar el rendimiento
CREATE INDEX idx_odoo_credentials_user_id ON odoo_credentials(user_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_odoo_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at automáticamente
CREATE TRIGGER update_odoo_credentials_updated_at
    BEFORE UPDATE ON odoo_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_odoo_credentials_updated_at();

-- Comentarios para documentar la tabla
COMMENT ON TABLE odoo_credentials IS 'Almacena credenciales de Odoo para cada usuario';
COMMENT ON COLUMN odoo_credentials.url IS 'URL completa de la instancia de Odoo (ej: https://mi-empresa.odoo.com)';
COMMENT ON COLUMN odoo_credentials.database IS 'Nombre de la base de datos en Odoo';
COMMENT ON COLUMN odoo_credentials.username IS 'Nombre de usuario para autenticación en Odoo';
COMMENT ON COLUMN odoo_credentials.password IS 'Contraseña del usuario (debería estar encriptada)'; 