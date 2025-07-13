-- Crear tabla para credenciales de Holded
CREATE TABLE holded_credentials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    api_key TEXT NOT NULL,
    test_mode BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_holded_credentials_updated_at 
    BEFORE UPDATE ON holded_credentials 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Políticas RLS
ALTER TABLE holded_credentials ENABLE ROW LEVEL SECURITY;

-- Policy para que los usuarios solo puedan ver sus propias credenciales
CREATE POLICY "Usuarios pueden ver sus credenciales de Holded" ON holded_credentials
    FOR SELECT USING (auth.uid() = user_id);

-- Policy para que los usuarios solo puedan insertar sus propias credenciales
CREATE POLICY "Usuarios pueden insertar sus credenciales de Holded" ON holded_credentials
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy para que los usuarios solo puedan actualizar sus propias credenciales
CREATE POLICY "Usuarios pueden actualizar sus credenciales de Holded" ON holded_credentials
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy para que los usuarios solo puedan eliminar sus propias credenciales
CREATE POLICY "Usuarios pueden eliminar sus credenciales de Holded" ON holded_credentials
    FOR DELETE USING (auth.uid() = user_id);

-- Índice para mejorar performance en consultas por user_id
CREATE INDEX idx_holded_credentials_user_id ON holded_credentials(user_id);

-- Restricción para asegurar que solo haya una configuración activa por usuario
CREATE UNIQUE INDEX idx_holded_credentials_user_active 
    ON holded_credentials(user_id) 
    WHERE is_active = true; 