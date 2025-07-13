-- Añadir campos de Stripe a la tabla profiles existente
-- Solo añadir si no existen

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS billing_period TEXT;

-- Añadir constraint para billing_period
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_name = 'profiles' 
        AND constraint_name LIKE '%billing_period%'
    ) THEN
        ALTER TABLE profiles 
        ADD CONSTRAINT profiles_billing_period_check 
        CHECK (billing_period IN ('monthly', 'yearly'));
    END IF;
END $$;

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id ON profiles(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_trial_end ON profiles(trial_end);

-- Añadir nuevos planes para Stripe
INSERT INTO plans (nombre, descripcion, limite_recibos, precio)
SELECT 'Pro Mensual', 'Plan profesional mensual con 100 recibos. Incluye 1 mes de prueba gratis.', 100, 19.99
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE nombre = 'Pro Mensual');

INSERT INTO plans (nombre, descripcion, limite_recibos, precio)
SELECT 'Pro Anual', 'Plan profesional anual con 100 recibos. Incluye 1 mes de prueba gratis. Ahorra 2 meses.', 100, 199.99
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE nombre = 'Pro Anual');

INSERT INTO plans (nombre, descripcion, limite_recibos, precio)
SELECT 'Unlimited Mensual', 'Plan ilimitado mensual con 2000 recibos. Para empresas que necesitan máxima capacidad.', 2000, 49.99
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE nombre = 'Unlimited Mensual');

INSERT INTO plans (nombre, descripcion, limite_recibos, precio)
SELECT 'Unlimited Anual', 'Plan ilimitado anual con 2000 recibos. Para empresas que necesitan máxima capacidad. Ahorra 2 meses.', 2000, 499.99
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE nombre = 'Unlimited Anual'); 