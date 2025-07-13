-- Migración para actualizar el esquema de Stripe con nuevos campos
-- Fecha: 2025-01-14

-- Añadir nuevos campos a la tabla profiles para el sistema de Stripe mejorado
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS billing_period TEXT CHECK (billing_period IN ('monthly', 'yearly'));

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id ON profiles(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_trial_end ON profiles(trial_end);

-- Actualizar la tabla de planes con nuevos nombres para diferenciación mensual/anual
-- Primero eliminamos los planes existentes
TRUNCATE TABLE plans CASCADE;

-- Insertar planes actualizados con diferenciación mensual/anual
INSERT INTO plans (id, nombre, descripcion, limite_recibos, precio) VALUES
(
    gen_random_uuid(),
    'Básico',
    'Plan gratuito con 5 recibos mensuales incluidos. Perfecto para empezar.',
    5,
    0.00
),
(
    gen_random_uuid(),
    'Pro Mensual',
    'Plan profesional mensual con 100 recibos. Incluye 1 mes de prueba gratis.',
    100,
    19.99
),
(
    gen_random_uuid(),
    'Pro Anual',
    'Plan profesional anual con 100 recibos. Incluye 1 mes de prueba gratis. Ahorra 2 meses.',
    100,
    199.99
),
(
    gen_random_uuid(),
    'Unlimited Mensual',
    'Plan ilimitado mensual con 2000 recibos. Para empresas que necesitan máxima capacidad.',
    2000,
    49.99
),
(
    gen_random_uuid(),
    'Unlimited Anual',
    'Plan ilimitado anual con 2000 recibos. Para empresas que necesitan máxima capacidad. Ahorra 2 meses.',
    2000,
    499.99
);

-- Actualizar todos los perfiles existentes para que tengan el plan básico
UPDATE profiles 
SET plan_id = (
    SELECT id FROM plans WHERE nombre = 'Básico' LIMIT 1
)
WHERE plan_id IS NULL OR plan_id NOT IN (SELECT id FROM plans);

-- Crear función para limpiar datos de Stripe cuando se cancela una suscripción
CREATE OR REPLACE FUNCTION clean_stripe_data_on_cancellation()
RETURNS TRIGGER AS $$
BEGIN
    -- Si la suscripción se cancela, limpiar datos relacionados
    IF NEW.subscription_status = 'canceled' AND OLD.subscription_status != 'canceled' THEN
        NEW.trial_end = NULL;
        NEW.billing_period = NULL;
        NEW.stripe_subscription_id = NULL;
        NEW.is_subscribed = FALSE;
        
        -- Asignar plan básico
        NEW.plan_id = (SELECT id FROM plans WHERE nombre = 'Básico' LIMIT 1);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para limpiar datos de Stripe
DROP TRIGGER IF EXISTS clean_stripe_data_trigger ON profiles;
CREATE TRIGGER clean_stripe_data_trigger
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    WHEN (NEW.subscription_status IS DISTINCT FROM OLD.subscription_status)
    EXECUTE FUNCTION clean_stripe_data_on_cancellation();

-- Función para obtener información del plan actual del usuario
CREATE OR REPLACE FUNCTION get_user_plan_info(user_uuid UUID)
RETURNS TABLE (
    plan_name TEXT,
    plan_limit INTEGER,
    plan_price DECIMAL,
    is_subscribed BOOLEAN,
    subscription_status TEXT,
    trial_end TIMESTAMP WITH TIME ZONE,
    billing_period TEXT,
    receipts_used INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.nombre,
        p.limite_recibos,
        p.precio,
        pr.is_subscribed,
        pr.subscription_status,
        pr.trial_end,
        pr.billing_period,
        pr.recibos_mes_actual
    FROM profiles pr
    JOIN plans p ON pr.plan_id = p.id
    WHERE pr.id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Función para verificar si un usuario puede subir más recibos
CREATE OR REPLACE FUNCTION can_upload_receipt(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_limit INTEGER;
    current_count INTEGER;
    user_subscribed BOOLEAN;
BEGIN
    -- Obtener límite del plan y contador actual
    SELECT p.limite_recibos, pr.recibos_mes_actual, pr.is_subscribed
    INTO user_limit, current_count, user_subscribed
    FROM profiles pr
    JOIN plans p ON pr.plan_id = p.id
    WHERE pr.id = user_uuid;
    
    -- Si no se encuentra el usuario, denegar
    IF user_limit IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Si está suscrito o en trial, permitir hasta el límite
    IF user_subscribed OR current_count < user_limit THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Comentario para recordar configurar los price IDs en Stripe
-- IMPORTANTE: Actualizar los price IDs en src/lib/stripe.ts con los valores reales de Stripe:
-- - price_pro_monthly_trial: Precio Pro mensual con 30 días de prueba
-- - price_pro_yearly_trial: Precio Pro anual con 30 días de prueba  
-- - price_unlimited_monthly: Precio Unlimited mensual
-- - price_unlimited_yearly: Precio Unlimited anual 