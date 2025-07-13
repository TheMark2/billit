-- Crear tabla para credenciales OAuth de Xero
CREATE TABLE xero_credentials (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL, -- Token de acceso encriptado
    refresh_token TEXT NOT NULL, -- Refresh token encriptado
    token_type TEXT NOT NULL DEFAULT 'Bearer', -- Tipo de token
    expires_in INTEGER NOT NULL DEFAULT 1800, -- Duración del token en segundos
    scope TEXT NOT NULL DEFAULT '', -- Permisos concedidos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Crear tabla para estados temporales de OAuth
CREATE TABLE xero_oauth_states (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    state TEXT NOT NULL UNIQUE, -- Estado único para validar el flujo OAuth
    code_verifier TEXT NOT NULL, -- PKCE code verifier
    redirect_uri TEXT NOT NULL, -- URI de redirección
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Expiración del estado
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security) para credenciales
ALTER TABLE xero_credentials ENABLE ROW LEVEL SECURITY;

-- Crear políticas para que los usuarios solo puedan acceder a sus propias credenciales
CREATE POLICY "Users can view their own xero credentials" ON xero_credentials
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own xero credentials" ON xero_credentials
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own xero credentials" ON xero_credentials
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own xero credentials" ON xero_credentials
    FOR DELETE USING (auth.uid() = user_id);

-- Habilitar RLS para estados OAuth (tabla temporal)
ALTER TABLE xero_oauth_states ENABLE ROW LEVEL SECURITY;

-- Crear políticas para estados OAuth
CREATE POLICY "Users can view their own xero oauth states" ON xero_oauth_states
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own xero oauth states" ON xero_oauth_states
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own xero oauth states" ON xero_oauth_states
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own xero oauth states" ON xero_oauth_states
    FOR DELETE USING (auth.uid() = user_id);

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_xero_credentials_user_id ON xero_credentials(user_id);
CREATE INDEX idx_xero_oauth_states_user_id ON xero_oauth_states(user_id);
CREATE INDEX idx_xero_oauth_states_state ON xero_oauth_states(state);
CREATE INDEX idx_xero_oauth_states_expires_at ON xero_oauth_states(expires_at);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_xero_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at automáticamente
CREATE TRIGGER update_xero_credentials_updated_at
    BEFORE UPDATE ON xero_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_xero_credentials_updated_at();

-- Función para limpiar estados OAuth expirados
CREATE OR REPLACE FUNCTION cleanup_expired_xero_oauth_states()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM xero_oauth_states 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Comentarios para documentar las tablas
COMMENT ON TABLE xero_credentials IS 'Almacena credenciales OAuth 2.0 de Xero encriptadas';
COMMENT ON TABLE xero_oauth_states IS 'Almacena temporalmente estados OAuth durante el flujo de autorización';
COMMENT ON FUNCTION cleanup_expired_xero_oauth_states() IS 'Limpia estados OAuth expirados - ejecutar periódicamente'; 