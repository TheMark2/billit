-- Migration to completely remove empresa dependencies and adapt for ticket-focused workflow
-- Date: 2025-01-18
-- Part 2: Complete removal with dependency handling

-- 1. Drop all policies that depend on empresa_id from profiles
DROP POLICY IF EXISTS "Usuarios pueden ver empresas a las que pertenecen" ON empresas;
DROP POLICY IF EXISTS "Usuarios pueden actualizar empresas a las que pertenecen" ON empresas;
DROP POLICY IF EXISTS "Usuarios pueden eliminar empresas a las que pertenecen" ON empresas;
DROP POLICY IF EXISTS "Usuarios pueden insertar empresas si están autenticados" ON empresas;

-- 2. Drop all receipt policies that depend on empresa_id
DROP POLICY IF EXISTS "Users can view their own receipts and company receipts" ON receipts;
DROP POLICY IF EXISTS "Users can insert their own receipts and company receipts" ON receipts;
DROP POLICY IF EXISTS "Users can update their own receipts and company receipts" ON receipts;
DROP POLICY IF EXISTS "Users can delete their own receipts and company receipts" ON receipts;
DROP POLICY IF EXISTS "Users can view their own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can insert their own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can update their own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can delete their own receipts" ON receipts;

-- 3. Drop any functions that might depend on empresa_id
DROP FUNCTION IF EXISTS get_user_receipts_with_company(UUID);
DROP FUNCTION IF EXISTS change_user_company(UUID, UUID);

-- 4. Drop indexes related to empresa
DROP INDEX IF EXISTS idx_profiles_empresa_id;
DROP INDEX IF EXISTS idx_receipts_empresa_id;
DROP INDEX IF EXISTS idx_empresas_cif;
DROP INDEX IF EXISTS idx_empresas_created_by;

-- 5. Drop the empresas table completely
DROP TABLE IF EXISTS empresas CASCADE;

-- 6. Update the tipo_factura constraint to allow 'ticket'
ALTER TABLE receipts 
  DROP CONSTRAINT IF EXISTS receipts_tipo_factura_check;

-- Add new constraint that includes 'ticket'
ALTER TABLE receipts 
  ADD CONSTRAINT receipts_tipo_factura_check CHECK (
    tipo_factura IN (
        'invoice',          -- Factura
        'receipt',          -- Recibo
        'ticket',           -- Ticket digitalizado
        'quote',            -- Presupuesto
        'purchase_order',   -- Pedido
        'credit_note',      -- Nota de crédito/abono
        'statement',        -- Extracto
        'payslip',          -- Nómina
        'other_financial'   -- Otro tipo de documento financiero
    )
  );

-- 7. Now safely remove empresa_id columns
ALTER TABLE profiles DROP COLUMN IF EXISTS empresa_id;
ALTER TABLE receipts DROP COLUMN IF EXISTS empresa_id;

-- 8. Update receipts table to focus on ticket processing
ALTER TABLE receipts 
  ALTER COLUMN tipo_factura SET DEFAULT 'ticket';

-- 9. Update any existing data to use 'ticket' as document type
UPDATE receipts 
SET tipo_factura = 'ticket' 
WHERE tipo_factura = 'invoice' OR tipo_factura IS NULL;

-- 10. Create ticket-pdfs storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-pdfs', 'ticket-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- 11. Create storage policies for ticket-pdfs bucket
CREATE POLICY "Users can upload their own ticket PDFs" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'ticket-pdfs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own ticket PDFs" ON storage.objects
FOR SELECT USING (
  bucket_id = 'ticket-pdfs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own ticket PDFs" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'ticket-pdfs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own ticket PDFs" ON storage.objects
FOR DELETE USING (
  bucket_id = 'ticket-pdfs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 12. Create new simplified policies for ticket-focused workflow
CREATE POLICY "Users can view their own tickets" ON receipts
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own tickets" ON receipts
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own tickets" ON receipts
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own tickets" ON receipts
FOR DELETE USING (user_id = auth.uid());

-- 13. Clean up any remaining empresa references (optional)
-- Note: If needed, you can manually clean auth.users metadata from the dashboard:
-- UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data - 'empresa' WHERE raw_user_meta_data ? 'empresa';
-- This step is optional since we're removing empresa functionality entirely

-- 14. Comment on the changes
COMMENT ON TABLE receipts IS 'Table for storing digitized tickets and receipts';
COMMENT ON COLUMN receipts.tipo_factura IS 'Document type, defaults to ticket for digitized receipts'; 