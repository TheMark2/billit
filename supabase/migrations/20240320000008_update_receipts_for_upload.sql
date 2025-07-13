-- Añadir campos necesarios para el upload de archivos
ALTER TABLE receipts 
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending_processing';

-- Crear índice para el status
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_file_path ON receipts(file_path);

-- Actualizar las políticas RLS para permitir uploads
-- Las políticas existentes ya deberían cubrir esto, pero aseguramos que sean correctas

-- Política para ver archivos propios
DROP POLICY IF EXISTS "Users can view their own receipts" ON receipts;
CREATE POLICY "Users can view their own receipts"
    ON receipts FOR SELECT
    USING (auth.uid() = user_id);

-- Política para insertar archivos propios
DROP POLICY IF EXISTS "Users can insert their own receipts" ON receipts;
CREATE POLICY "Users can insert their own receipts"
    ON receipts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Política para actualizar archivos propios
DROP POLICY IF EXISTS "Users can update their own receipts" ON receipts;
CREATE POLICY "Users can update their own receipts"
    ON receipts FOR UPDATE
    USING (auth.uid() = user_id);

-- Política para eliminar archivos propios
DROP POLICY IF EXISTS "Users can delete their own receipts" ON receipts;
CREATE POLICY "Users can delete their own receipts"
    ON receipts FOR DELETE
    USING (auth.uid() = user_id);

-- Crear bucket de storage si no existe (esto se debe hacer desde el dashboard de Supabase)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false)
-- ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para el bucket receipts
-- Estas se deben configurar desde el dashboard de Supabase o usando SQL directo:

-- Política para ver archivos propios en storage
-- CREATE POLICY "Users can view own files" ON storage.objects
-- FOR SELECT USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Política para subir archivos propios en storage  
-- CREATE POLICY "Users can upload own files" ON storage.objects
-- FOR INSERT WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Política para actualizar archivos propios en storage
-- CREATE POLICY "Users can update own files" ON storage.objects
-- FOR UPDATE USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Política para eliminar archivos propios en storage
-- CREATE POLICY "Users can delete own files" ON storage.objects
-- FOR DELETE USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]); 