-- Migración específica para campos de Stripe
-- Fecha: 2025-01-14

-- Añadir campos de Stripe a profiles si no existen
DO $$
BEGIN
    -- Stripe customer ID
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id') THEN
        ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT;
    END IF;
    
    -- Stripe subscription ID
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'stripe_subscription_id') THEN
        ALTER TABLE profiles ADD COLUMN stripe_subscription_id TEXT;
    END IF;
    
    -- Subscription status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'subscription_status') THEN
        ALTER TABLE profiles ADD COLUMN subscription_status TEXT DEFAULT 'inactive';
    END IF;
    
    -- Trial end date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'trial_end') THEN
        ALTER TABLE profiles ADD COLUMN trial_end TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Billing period
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'billing_period') THEN
        ALTER TABLE profiles ADD COLUMN billing_period TEXT CHECK (billing_period IN ('monthly', 'yearly'));
    END IF;
END $$;

-- Crear índices si no existen
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id ON profiles(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_trial_end ON profiles(trial_end);

-- Actualizar planes para incluir versiones mensuales/anuales
DO $$
BEGIN
    -- Verificar si ya existen los planes Pro Mensual y Pro Anual
    IF NOT EXISTS (SELECT 1 FROM plans WHERE nombre = 'Pro Mensual') THEN
        INSERT INTO plans (nombre, descripcion, limite_recibos, precio)
        VALUES ('Pro Mensual', 'Plan profesional mensual con 100 recibos. Incluye 1 mes de prueba gratis.', 100, 19.99);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM plans WHERE nombre = 'Pro Anual') THEN
        INSERT INTO plans (nombre, descripcion, limite_recibos, precio)
        VALUES ('Pro Anual', 'Plan profesional anual con 100 recibos. Incluye 1 mes de prueba gratis. Ahorra 2 meses.', 100, 199.99);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM plans WHERE nombre = 'Unlimited Mensual') THEN
        INSERT INTO plans (nombre, descripcion, limite_recibos, precio)
        VALUES ('Unlimited Mensual', 'Plan ilimitado mensual con 2000 recibos. Para empresas que necesitan máxima capacidad.', 2000, 49.99);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM plans WHERE nombre = 'Unlimited Anual') THEN
        INSERT INTO plans (nombre, descripcion, limite_recibos, precio)
        VALUES ('Unlimited Anual', 'Plan ilimitado anual con 2000 recibos. Para empresas que necesitan máxima capacidad. Ahorra 2 meses.', 2000, 499.99);
    END IF;
END $$;

-- Función para limpiar datos de Stripe cuando se cancela
CREATE OR REPLACE FUNCTION clean_stripe_data_on_cancellation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.subscription_status = 'canceled' AND OLD.subscription_status != 'canceled' THEN
        NEW.trial_end = NULL;
        NEW.billing_period = NULL;
        NEW.stripe_subscription_id = NULL;
        NEW.is_subscribed = FALSE;
        NEW.plan_id = (SELECT id FROM plans WHERE nombre = 'Básico' LIMIT 1);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger si no existe
DROP TRIGGER IF EXISTS clean_stripe_data_trigger ON profiles;
CREATE TRIGGER clean_stripe_data_trigger
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    WHEN (NEW.subscription_status IS DISTINCT FROM OLD.subscription_status)
    EXECUTE FUNCTION clean_stripe_data_on_cancellation();

-- Función para obtener información del plan del usuario
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