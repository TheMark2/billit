-- Agregar campo categoria_negocio a la tabla receipts para clasificación automática por IA
ALTER TABLE receipts 
ADD COLUMN IF NOT EXISTS categoria_negocio TEXT;

-- Crear índice para búsquedas por categoría
CREATE INDEX IF NOT EXISTS idx_receipts_categoria_negocio ON receipts(categoria_negocio);

-- Comentario sobre el campo
COMMENT ON COLUMN receipts.categoria_negocio IS 'Categoría del negocio detectada automáticamente por IA (ej: Restaurante, Supermercado, Farmacia, etc.)';