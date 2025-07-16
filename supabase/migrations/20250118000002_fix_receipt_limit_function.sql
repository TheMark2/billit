-- Fix check_receipt_limit function to remove empresa_id references
-- This function was still trying to access empresa_id which was removed

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

    -- Si no se encuentra el usuario o límite, usar límite por defecto
    IF user_limit IS NULL THEN
        user_limit := 10; -- límite por defecto para usuarios sin plan
    END IF;

    -- Obtener el conteo actual de recibos del usuario este mes
    SELECT COUNT(*) INTO current_count
    FROM receipts r
    WHERE r.user_id = NEW.user_id
    AND DATE_TRUNC('month', r.created_at) = DATE_TRUNC('month', CURRENT_TIMESTAMP);

    -- Verificar si excede el límite
    IF current_count >= user_limit THEN
        RAISE EXCEPTION 'Has alcanzado el límite de recibos de tu plan actual';
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION check_receipt_limit() IS 'Verifica el límite de recibos del usuario por mes basado en su plan'; 