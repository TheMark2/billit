-- Tabla para lista de espera de ReciptAI
-- Ejecutar este SQL en Supabase SQL Editor
-- Actualizado: 2025-01-19 para coincidir con el formulario actual
-- 
-- NOTA: Este script es seguro para re-ejecutar. Usa IF NOT EXISTS y DROP IF EXISTS
-- para evitar errores si los elementos ya existen.

CREATE TABLE IF NOT EXISTS waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL, -- Nombre completo (firstName + lastName)
  source VARCHAR(100) DEFAULT 'landing_page', -- De dónde viene el lead
  google_user_id VARCHAR(255), -- ID de Google si se registra con Google Auth
  google_avatar_url TEXT, -- URL del avatar de Google
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notified BOOLEAN DEFAULT FALSE, -- Si ya se le notificó del lanzamiento
  priority INTEGER DEFAULT 1, -- Prioridad en la lista (1 = alta, 5 = baja)
  notes TEXT -- Notas adicionales del admin
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_source ON waitlist(source);
CREATE INDEX IF NOT EXISTS idx_waitlist_notified ON waitlist(notified);

-- RLS (Row Level Security) - opcional, depende de tus necesidades
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen (para re-ejecución)
DROP POLICY IF EXISTS "Allow public insert" ON waitlist;
DROP POLICY IF EXISTS "Allow admin read" ON waitlist;

-- Política para permitir inserción pública (para el formulario)
CREATE POLICY "Allow public insert" ON waitlist
  FOR INSERT 
  WITH CHECK (true);

-- Política para que solo admins puedan leer
CREATE POLICY "Allow admin read" ON waitlist
  FOR SELECT 
  USING (auth.role() = 'authenticated' AND auth.jwt() ->> 'role' = 'admin');

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at (eliminar si existe)
DROP TRIGGER IF EXISTS update_waitlist_updated_at ON waitlist;
CREATE TRIGGER update_waitlist_updated_at 
  BEFORE UPDATE ON waitlist 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentación
COMMENT ON TABLE waitlist IS 'Lista de espera para usuarios interesados en ReciptAI - Actualizado 2025-01-19';
COMMENT ON COLUMN waitlist.name IS 'Nombre completo del usuario (firstName + lastName del formulario)';
COMMENT ON COLUMN waitlist.source IS 'Origen del lead: landing_page, google_oauth, referral, etc.';
COMMENT ON COLUMN waitlist.priority IS 'Prioridad en la lista: 1=alta, 2=media-alta, 3=media, 4=media-baja, 5=baja';

-- INSTRUCCIONES DE MIGRACIÓN (si la tabla ya existe):
-- Si ya tienes una tabla waitlist con estructura diferente, ejecuta:
-- ALTER TABLE waitlist DROP COLUMN IF EXISTS company;
-- ALTER TABLE waitlist DROP COLUMN IF EXISTS phone;
-- ALTER TABLE waitlist DROP COLUMN IF EXISTS interests;
-- ALTER TABLE waitlist ALTER COLUMN name SET NOT NULL;
