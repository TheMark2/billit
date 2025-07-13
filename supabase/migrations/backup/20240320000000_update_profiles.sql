-- Actualizar la tabla de profiles con nuevos campos
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS telefono VARCHAR(20),
ADD COLUMN IF NOT EXISTS ciudad VARCHAR(100),
ADD COLUMN IF NOT EXISTS empresa VARCHAR(100),
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id),
ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

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

-- Insertar planes por defecto
INSERT INTO plans (nombre, descripcion, limite_recibos, precio) VALUES
('Básico', 'Plan básico con límite de 50 recibos mensuales', 50, 0),
('Pro', 'Plan profesional con límite de 200 recibos mensuales', 200, 29.99),
('Enterprise', 'Plan empresarial con recibos ilimitados', 999999, 99.99)
ON CONFLICT (id) DO NOTHING;

-- Crear trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_plans_updated_at
    BEFORE UPDATE ON plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 