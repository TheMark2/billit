-- Migración para limpiar carpetas duplicadas
-- ========================================================================

-- Eliminar carpetas duplicadas, manteniendo solo una por usuario y nombre
WITH duplicates AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY user_id, name ORDER BY created_at ASC) as rn
    FROM ticket_folders
)
DELETE FROM ticket_folders 
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- Actualizar tickets huérfanos para apuntar a carpetas válidas
UPDATE receipts 
SET folder_id = (
    SELECT tf.id 
    FROM ticket_folders tf 
    WHERE tf.user_id = receipts.user_id 
    AND tf.name = 'Sin categorizar' 
    LIMIT 1
)
WHERE folder_id IS NOT NULL 
AND NOT EXISTS (
    SELECT 1 FROM ticket_folders tf2 
    WHERE tf2.id = receipts.folder_id
); 