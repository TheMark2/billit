-- Habilitar la extensión uuid-ossp si no está habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear la tabla de planes si no existe
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    limite_recibos INTEGER NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insertar planes por defecto si no existen
INSERT INTO plans (nombre, descripcion, limite_recibos, precio) VALUES
('Básico', 'Plan básico con límite de 50 recibos mensuales', 50, 0),
('Pro', 'Plan profesional con límite de 200 recibos mensuales', 200, 29.99),
('Enterprise', 'Plan empresarial con recibos ilimitados', 999999, 99.99)
ON CONFLICT (id) DO NOTHING;

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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_telefono ON profiles(telefono);
CREATE INDEX idx_profiles_plan_id ON profiles(plan_id);

-- Crear función para actualizar el timestamp de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Crear trigger para actualizar updated_at en profiles
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Crear trigger para actualizar updated_at en plans
CREATE TRIGGER update_plans_updated_at
    BEFORE UPDATE ON plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Crear política RLS para profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Política para permitir la inserción de perfiles
CREATE POLICY "Enable insert for authenticated users"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Política para permitir la inserción desde la función handle_new_user
CREATE POLICY "Enable insert for service role"
    ON profiles FOR INSERT
    WITH CHECK (true);

-- Función para crear perfil automáticamente después del registro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER -- Esto es importante para que la función se ejecute con los permisos del propietario
SET search_path = public -- Establecer el search_path por seguridad
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, nombre, apellido)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'nombre',
        NEW.raw_user_meta_data->>'apellido'
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para crear perfil automáticamente
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 