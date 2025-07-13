-- Primero, eliminar los planes existentes
TRUNCATE TABLE plans CASCADE;

-- Reinsertar los planes con los nuevos límites
INSERT INTO plans (id, nombre, descripcion, limite_recibos, precio) VALUES
(
    uuid_generate_v4(),
    'Básico',
    'Plan gratuito con 5 recibos mensuales incluidos. Perfecto para empezar.',
    5,
    0
),
(
    uuid_generate_v4(),
    'Pro',
    'Plan profesional con 100 recibos mensuales. Ideal para pequeñas y medianas empresas.',
    100,
    19.99
),
(
    uuid_generate_v4(),
    'Unlimited',
    'Plan sin límites con 2000 recibos mensuales. Para empresas que necesitan máxima capacidad.',
    2000,
    49.99
);

-- Crear la tabla de recibos si no existe
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    fecha_emision DATE NOT NULL,
    fecha_subida TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    proveedor VARCHAR(255),
    numero_factura VARCHAR(100),
    total DECIMAL(10,2) NOT NULL,
    moneda VARCHAR(3) DEFAULT 'EUR',
    estado VARCHAR(50) DEFAULT 'pendiente',
    url_archivo TEXT,
    texto_extraido TEXT,
    metadatos JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para la tabla receipts
CREATE INDEX idx_receipts_user_id ON receipts(user_id);
CREATE INDEX idx_receipts_fecha_emision ON receipts(fecha_emision);
CREATE INDEX idx_receipts_estado ON receipts(estado);

-- Habilitar RLS para receipts
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para receipts
CREATE POLICY "Users can view their own receipts"
    ON receipts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own receipts"
    ON receipts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own receipts"
    ON receipts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own receipts"
    ON receipts FOR DELETE
    USING (auth.uid() = user_id);

-- Actualizar la función handle_new_user para asignar el plan básico
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    basic_plan_id UUID;
BEGIN
    -- Obtener el ID del plan básico
    SELECT id INTO basic_plan_id FROM plans WHERE nombre = 'Básico' AND precio = 0 LIMIT 1;
    
    -- Si por alguna razón no encontramos el plan básico, lanzar un error
    IF basic_plan_id IS NULL THEN
        RAISE EXCEPTION 'Plan básico no encontrado';
    END IF;

    INSERT INTO public.profiles (
        id,
        email,
        nombre,
        apellido,
        telefono,
        ciudad,
        empresa,
        plan_id,
        is_subscribed,
        recibos_mes_actual
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
        COALESCE(NEW.raw_user_meta_data->>'apellido', ''),
        COALESCE(NEW.raw_user_meta_data->>'telefono', ''),
        COALESCE(NEW.raw_user_meta_data->>'ciudad', ''),
        COALESCE(NEW.raw_user_meta_data->>'empresa', ''),
        basic_plan_id,  -- Asignar el plan básico
        false,         -- No está suscrito inicialmente
        0             -- Comenzar con 0 recibos este mes
    );
    RETURN NEW;
END;
$$;

-- Crear una función para verificar el límite de recibos
CREATE OR REPLACE FUNCTION check_receipt_limit()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    user_limit INTEGER;
    current_count INTEGER;
BEGIN
    -- Obtener el límite del plan del usuario
    SELECT p.limite_recibos INTO user_limit
    FROM profiles pr
    JOIN plans p ON pr.plan_id = p.id
    WHERE pr.id = NEW.user_id;

    -- Obtener el conteo actual de recibos del usuario este mes
    SELECT recibos_mes_actual INTO current_count
    FROM profiles
    WHERE id = NEW.user_id;

    -- Verificar si excede el límite
    IF current_count >= user_limit THEN
        RAISE EXCEPTION 'Has alcanzado el límite de recibos de tu plan actual';
    END IF;

    -- Incrementar el contador de recibos
    UPDATE profiles
    SET recibos_mes_actual = recibos_mes_actual + 1
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$;

-- Crear un trigger para la tabla de recibos
DROP TRIGGER IF EXISTS check_receipt_limit_trigger ON receipts;
CREATE TRIGGER check_receipt_limit_trigger
    BEFORE INSERT ON receipts
    FOR EACH ROW
    EXECUTE FUNCTION check_receipt_limit();

-- Trigger para actualizar updated_at en receipts
CREATE TRIGGER update_receipts_updated_at
    BEFORE UPDATE ON receipts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Crear una función para resetear el contador de recibos mensualmente
CREATE OR REPLACE FUNCTION reset_monthly_receipt_count()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE profiles SET recibos_mes_actual = 0;
END;
$$;

-- Comentario: Necesitarás configurar un cron job para ejecutar reset_monthly_receipt_count()
-- al inicio de cada mes. Esto se puede hacer desde el dashboard de Supabase o
-- usando pg_cron si está disponible en tu instalación. 