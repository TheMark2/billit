-- Eliminar tablas existentes si existen
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS plans CASCADE;

-- Eliminar funciones y triggers existentes
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Habilitar la extensión uuid-ossp
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear la tabla de planes
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    limite_recibos INTEGER NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insertar planes por defecto
INSERT INTO plans (nombre, descripcion, limite_recibos, precio) VALUES
('Básico', 'Plan básico con límite de 50 recibos mensuales', 50, 0),
('Pro', 'Plan profesional con límite de 200 recibos mensuales', 200, 29.99),
('Enterprise', 'Plan empresarial con recibos ilimitados', 999999, 99.99);

-- Crear la tabla profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre VARCHAR(100),
    apellido VARCHAR(100),
    email VARCHAR(255),
    telefono VARCHAR(20),
    ciudad VARCHAR(100),
    empresa VARCHAR(100),
    nacimiento DATE,
    avatar_url TEXT,
    plan_id UUID REFERENCES plans(id),
    is_subscribed BOOLEAN DEFAULT false,
    recibos_mes_actual INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT proper_email CHECK (email ~* '^[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$')
);

-- Crear índices
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_telefono ON profiles(telefono);
CREATE INDEX idx_profiles_plan_id ON profiles(plan_id);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plans_updated_at
    BEFORE UPDATE ON plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Enable insert for users and service role" 
    ON profiles FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Enable select for users based on user_id" 
    ON profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Enable update for users based on user_id" 
    ON profiles FOR UPDATE 
    USING (auth.uid() = id);

-- Función para manejar nuevos usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    default_plan_id UUID;
BEGIN
    -- Obtener el ID del plan básico
    SELECT id INTO default_plan_id FROM plans WHERE nombre = 'Básico' LIMIT 1;
    
    INSERT INTO public.profiles (
        id,
        email,
        nombre,
        apellido,
        telefono,
        ciudad,
        empresa,
        plan_id,
        is_subscribed
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
        COALESCE(NEW.raw_user_meta_data->>'apellido', ''),
        COALESCE(NEW.raw_user_meta_data->>'telefono', ''),
        COALESCE(NEW.raw_user_meta_data->>'ciudad', ''),
        COALESCE(NEW.raw_user_meta_data->>'empresa', ''),
        default_plan_id,
        false
    );
    RETURN NEW;
END;
$$;

-- Trigger para crear perfil automáticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Otorgar permisos necesarios
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon; 