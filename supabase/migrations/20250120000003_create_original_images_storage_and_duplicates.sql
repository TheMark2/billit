-- Migración para almacenamiento de imágenes originales y detección de duplicados
-- ========================================================================

-- 1. Crear bucket para imágenes originales si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('original-receipts', 'original-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Crear políticas de storage para el bucket original-receipts
CREATE POLICY "Users can upload their own receipt images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'original-receipts' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own receipt images" ON storage.objects
FOR SELECT USING (
  bucket_id = 'original-receipts' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own receipt images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'original-receipts' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own receipt images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'original-receipts' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. Añadir columna para el path de la imagen original
ALTER TABLE receipts 
ADD COLUMN IF NOT EXISTS original_image_path TEXT;

-- 4. Crear índice para el path de imagen original
CREATE INDEX IF NOT EXISTS idx_receipts_original_image_path ON receipts(original_image_path);

-- 5. Función para detectar recibos duplicados
CREATE OR REPLACE FUNCTION find_potential_duplicates(
    user_id_param UUID,
    proveedor_param VARCHAR(255),
    total_param DECIMAL(10,2),
    fecha_emision_param DATE,
    threshold_days INTEGER DEFAULT 7,
    threshold_amount DECIMAL(10,2) DEFAULT 5.0
)
RETURNS TABLE (
    receipt_id UUID,
    proveedor VARCHAR(255),
    total DECIMAL(10,2),
    fecha_emision DATE,
    similarity_score DECIMAL(5,2)
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id as receipt_id,
        r.proveedor,
        r.total,
        r.fecha_emision,
        -- Calcular score de similitud (0-100)
        (
            CASE 
                WHEN LOWER(r.proveedor) = LOWER(proveedor_param) THEN 50.0
                WHEN similarity(LOWER(r.proveedor), LOWER(proveedor_param)) > 0.3 THEN 25.0
                ELSE 0.0
            END +
            CASE 
                WHEN ABS(r.total - total_param) = 0 THEN 40.0
                WHEN ABS(r.total - total_param) <= threshold_amount THEN 20.0
                ELSE 0.0
            END +
            CASE 
                WHEN r.fecha_emision = fecha_emision_param THEN 10.0
                WHEN ABS(EXTRACT(DAYS FROM (r.fecha_emision - fecha_emision_param))) <= threshold_days THEN 5.0
                ELSE 0.0
            END
        )::DECIMAL(5,2) as similarity_score
    FROM receipts r
    WHERE 
        r.user_id = user_id_param
        AND (
            -- Mismo proveedor o similar
            (LOWER(r.proveedor) = LOWER(proveedor_param) OR similarity(LOWER(r.proveedor), LOWER(proveedor_param)) > 0.3)
            OR
            -- Mismo total o muy similar
            ABS(r.total - total_param) <= threshold_amount
        )
        AND ABS(EXTRACT(DAYS FROM (r.fecha_emision - fecha_emision_param))) <= threshold_days
    HAVING 
        -- Solo devolver resultados con score >= 30 (probable duplicado)
        (
            CASE 
                WHEN LOWER(r.proveedor) = LOWER(proveedor_param) THEN 50.0
                WHEN similarity(LOWER(r.proveedor), LOWER(proveedor_param)) > 0.3 THEN 25.0
                ELSE 0.0
            END +
            CASE 
                WHEN ABS(r.total - total_param) = 0 THEN 40.0
                WHEN ABS(r.total - total_param) <= threshold_amount THEN 20.0
                ELSE 0.0
            END +
            CASE 
                WHEN r.fecha_emision = fecha_emision_param THEN 10.0
                WHEN ABS(EXTRACT(DAYS FROM (r.fecha_emision - fecha_emision_param))) <= threshold_days THEN 5.0
                ELSE 0.0
            END
        ) >= 30.0
    ORDER BY similarity_score DESC
    LIMIT 5;
END;
$$;

-- 6. Habilitar extensión pg_trgm para búsqueda de similitud de texto si no está habilitada
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 7. Crear índice para mejorar rendimiento de búsquedas de similitud
CREATE INDEX IF NOT EXISTS idx_receipts_proveedor_trigram ON receipts USING gin (LOWER(proveedor) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_receipts_user_date_total ON receipts(user_id, fecha_emision, total);

-- 8. Función para marcar un recibo como duplicado
CREATE OR REPLACE FUNCTION mark_as_duplicate(
    receipt_id_param UUID,
    duplicate_of_param UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Actualizar metadatos para marcar como duplicado
    UPDATE receipts 
    SET metadatos = COALESCE(metadatos, '{}'::jsonb) || 
                   jsonb_build_object(
                       'is_duplicate', true,
                       'duplicate_of', duplicate_of_param,
                       'marked_duplicate_at', CURRENT_TIMESTAMP
                   ),
        estado = 'duplicado'
    WHERE id = receipt_id_param;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RETURN updated_count > 0;
END;
$$;

-- 9. Función para desmarcar un recibo como duplicado
CREATE OR REPLACE FUNCTION unmark_as_duplicate(receipt_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Remover marcas de duplicado de metadatos
    UPDATE receipts 
    SET metadatos = COALESCE(metadatos, '{}'::jsonb) - 'is_duplicate' - 'duplicate_of' - 'marked_duplicate_at',
        estado = 'procesado'
    WHERE id = receipt_id_param;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RETURN updated_count > 0;
END;
$$;

-- 10. Crear tabla para histórico de detección de duplicados (opcional)
CREATE TABLE IF NOT EXISTS duplicate_detections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    receipt_id UUID REFERENCES receipts(id) ON DELETE CASCADE NOT NULL,
    potential_duplicates UUID[] NOT NULL,
    similarity_scores DECIMAL(5,2)[] NOT NULL,
    detection_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    action_taken VARCHAR(50), -- 'marked_duplicate', 'ignored', 'pending'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Crear índices para la tabla de detección de duplicados
CREATE INDEX IF NOT EXISTS idx_duplicate_detections_user_id ON duplicate_detections(user_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_detections_receipt_id ON duplicate_detections(receipt_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_detections_detection_date ON duplicate_detections(detection_date);

-- 12. Habilitar RLS para la tabla de detección de duplicados
ALTER TABLE duplicate_detections ENABLE ROW LEVEL SECURITY;

-- 13. Políticas RLS para duplicate_detections
CREATE POLICY "Users can view their own duplicate detections"
    ON duplicate_detections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own duplicate detections"
    ON duplicate_detections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own duplicate detections"
    ON duplicate_detections FOR UPDATE
    USING (auth.uid() = user_id);

-- 14. Actualizar estados existentes y añadir constraint
DO $$
BEGIN
    -- Primero, actualizar estados que no coinciden con los nuevos valores permitidos
    UPDATE receipts 
    SET estado = CASE 
        WHEN estado IN ('pending', 'pending_processing') THEN 'pendiente'
        WHEN estado IN ('processed', 'success', 'synced') THEN 'procesado'
        WHEN estado IN ('failed', 'failure') THEN 'error'
        WHEN estado = 'duplicate' THEN 'duplicado'
        WHEN estado = 'archived' THEN 'archivado'
        WHEN estado IS NULL THEN 'pendiente'
        ELSE estado -- Mantener si ya está en formato correcto
    END
    WHERE estado NOT IN ('pendiente', 'procesado', 'error', 'duplicado', 'archivado') 
       OR estado IS NULL;

    -- Eliminar constraint existente si existe
    BEGIN
        ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_estado_check;
    EXCEPTION WHEN OTHERS THEN
        -- Ignorar errores si no existe
    END;
    
    -- Añadir nuevo constraint
    ALTER TABLE receipts ADD CONSTRAINT receipts_estado_check CHECK (
        estado IN ('pendiente', 'procesado', 'error', 'duplicado', 'archivado')
    );
    
    -- Mensaje informativo
    RAISE NOTICE 'Estados de recibos actualizados y constraint aplicado correctamente';
END $$; 