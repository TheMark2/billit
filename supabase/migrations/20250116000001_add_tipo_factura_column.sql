-- Agregar columna tipo_factura a la tabla receipts
-- Fecha: 2025-01-16

-- Añadir la columna tipo_factura con valores predefinidos
ALTER TABLE receipts 
ADD COLUMN IF NOT EXISTS tipo_factura TEXT CHECK (
    tipo_factura IN (
        'invoice',          -- Factura
        'receipt',          -- Recibo
        'quote',            -- Presupuesto
        'purchase_order',   -- Pedido
        'credit_note',      -- Nota de crédito/abono
        'statement',        -- Extracto
        'payslip',          -- Nómina
        'other_financial'   -- Otro tipo de documento financiero
    )
) DEFAULT 'invoice';

-- Crear índice para mejorar el rendimiento en consultas por tipo
CREATE INDEX IF NOT EXISTS idx_receipts_tipo_factura ON receipts(tipo_factura);

-- Migrar datos existentes: extraer tipo_factura desde metadatos.mindee_data.document_type
UPDATE receipts 
SET tipo_factura = CASE 
    WHEN metadatos->'mindee_data'->>'document_type' = 'INVOICE' THEN 'invoice'
    WHEN metadatos->'mindee_data'->>'document_type' = 'RECEIPT' THEN 'receipt'
    WHEN metadatos->'mindee_data'->>'document_type' = 'QUOTE' THEN 'quote'
    WHEN metadatos->'mindee_data'->>'document_type' = 'PURCHASE_ORDER' THEN 'purchase_order'
    WHEN metadatos->'mindee_data'->>'document_type' = 'CREDIT_NOTE' THEN 'credit_note'
    WHEN metadatos->'mindee_data'->>'document_type' = 'STATEMENT' THEN 'statement'
    WHEN metadatos->'mindee_data'->>'document_type' = 'PAYSLIP' THEN 'payslip'
    ELSE 'invoice' -- Por defecto, asumir que es factura
END
WHERE metadatos IS NOT NULL 
  AND metadatos->'mindee_data'->>'document_type' IS NOT NULL
  AND tipo_factura IS NULL;

-- Establecer 'invoice' como valor por defecto para registros sin tipo
UPDATE receipts 
SET tipo_factura = 'invoice' 
WHERE tipo_factura IS NULL;

-- Comentario sobre el uso de la columna
COMMENT ON COLUMN receipts.tipo_factura IS 'Tipo de documento financiero: invoice, receipt, quote, purchase_order, credit_note, statement, payslip, other_financial'; 