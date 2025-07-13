-- Agregar columna empresa_id a la tabla receipts
ALTER TABLE receipts 
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);

-- Crear índice para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_receipts_empresa_id ON receipts(empresa_id);

-- Actualizar las políticas RLS para incluir empresa_id
-- Eliminar las políticas existentes
DROP POLICY IF EXISTS "Users can view their own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can insert their own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can update their own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can delete their own receipts" ON receipts;

-- Crear nuevas políticas que consideren tanto user_id como empresa_id
CREATE POLICY "Users can view their own receipts and company receipts"
    ON receipts FOR SELECT
    USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.empresa_id = receipts.empresa_id
        )
    );

CREATE POLICY "Users can insert their own receipts and company receipts"
    ON receipts FOR INSERT
    WITH CHECK (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.empresa_id = receipts.empresa_id
        )
    );

CREATE POLICY "Users can update their own receipts and company receipts"
    ON receipts FOR UPDATE
    USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.empresa_id = receipts.empresa_id
        )
    );

CREATE POLICY "Users can delete their own receipts and company receipts"
    ON receipts FOR DELETE
    USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.empresa_id = receipts.empresa_id
        )
    );

-- Función para obtener recibos de un usuario incluyendo recibos de empresa
CREATE OR REPLACE FUNCTION get_user_receipts(user_uuid UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    empresa_id UUID,
    fecha_emision DATE,
    fecha_subida TIMESTAMP WITH TIME ZONE,
    proveedor VARCHAR,
    numero_factura VARCHAR,
    total DECIMAL,
    moneda VARCHAR,
    estado VARCHAR,
    url_archivo TEXT,
    texto_extraido TEXT,
    metadatos JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.user_id,
        r.empresa_id,
        r.fecha_emision,
        r.fecha_subida,
        r.proveedor,
        r.numero_factura,
        r.total,
        r.moneda,
        r.estado,
        r.url_archivo,
        r.texto_extraido,
        r.metadatos,
        r.created_at,
        r.updated_at
    FROM receipts r
    LEFT JOIN profiles p ON p.id = user_uuid
    WHERE r.user_id = user_uuid 
       OR r.empresa_id = p.empresa_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para que un usuario pueda cambiar de empresa
CREATE OR REPLACE FUNCTION switch_user_company(user_uuid UUID, new_empresa_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    empresa_exists BOOLEAN;
BEGIN
    -- Verificar que la empresa existe y el usuario tiene acceso
    SELECT EXISTS(
        SELECT 1 FROM empresas e
        WHERE e.id = new_empresa_id
        AND (e.created_by = user_uuid OR 
             EXISTS(SELECT 1 FROM profiles WHERE id = user_uuid AND empresa_id = new_empresa_id))
    ) INTO empresa_exists;
    
    IF NOT empresa_exists THEN
        RETURN FALSE;
    END IF;
    
    -- Actualizar el perfil del usuario
    UPDATE profiles 
    SET empresa_id = new_empresa_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = user_uuid;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Actualizar el trigger de check_receipt_limit para considerar empresa_id
CREATE OR REPLACE FUNCTION check_receipt_limit()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    user_limit INTEGER;
    current_count INTEGER;
    user_empresa_id UUID;
BEGIN
    -- Obtener el límite del plan del usuario y su empresa_id
    SELECT p.limite_recibos, pr.empresa_id INTO user_limit, user_empresa_id
    FROM profiles pr
    JOIN plans p ON pr.plan_id = p.id
    WHERE pr.id = NEW.user_id;

    -- Obtener el conteo actual de recibos del usuario este mes
    -- (incluye recibos personales y de empresa)
    SELECT COUNT(*) INTO current_count
    FROM receipts r
    WHERE (r.user_id = NEW.user_id OR r.empresa_id = user_empresa_id)
    AND DATE_TRUNC('month', r.created_at) = DATE_TRUNC('month', CURRENT_TIMESTAMP);

    -- Verificar si excede el límite
    IF current_count >= user_limit THEN
        RAISE EXCEPTION 'Has alcanzado el límite de recibos de tu plan actual';
    END IF;

    -- Si el recibo no tiene empresa_id pero el usuario tiene empresa, asignarla
    IF NEW.empresa_id IS NULL AND user_empresa_id IS NOT NULL THEN
        NEW.empresa_id := user_empresa_id;
    END IF;

    RETURN NEW;
END;
$$;

-- Comentarios sobre el uso futuro para múltiples empresas
-- Para implementar múltiples empresas por usuario en el futuro:
-- 1. Crear tabla user_empresas (user_id, empresa_id, role)
-- 2. Modificar las políticas RLS para usar esta tabla
-- 3. Agregar funciones para gestionar membresías de empresa
-- 4. Actualizar el frontend para permitir cambio de empresa

COMMENT ON COLUMN receipts.empresa_id IS 'ID de la empresa asociada al recibo, permite gestión multi-empresa';
COMMENT ON FUNCTION get_user_receipts(UUID) IS 'Obtiene todos los recibos de un usuario (personales y de empresa)';
COMMENT ON FUNCTION switch_user_company(UUID, UUID) IS 'Permite a un usuario cambiar de empresa activa'; 