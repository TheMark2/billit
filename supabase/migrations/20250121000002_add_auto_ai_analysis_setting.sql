-- Agregar campo para controlar el análisis automático de IA
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS auto_ai_analysis BOOLEAN DEFAULT true;

-- Agregar comentario al campo
COMMENT ON COLUMN profiles.auto_ai_analysis IS 'Controla si se ejecuta análisis automático de IA al subir tickets';

-- Crear índice para mejorar rendimiento en consultas
CREATE INDEX IF NOT EXISTS idx_profiles_auto_ai_analysis ON profiles(auto_ai_analysis);