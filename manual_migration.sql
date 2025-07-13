-- Script manual para agregar campos de subscription schedules
-- Ejecutar este SQL directamente en Supabase SQL Editor si tienes problemas con la migración

-- Agregar campos para manejar subscription schedules (downgrades programados)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS stripe_schedule_id TEXT,
ADD COLUMN IF NOT EXISTS scheduled_plan_id UUID REFERENCES plans(id),
ADD COLUMN IF NOT EXISTS schedule_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS schedule_status TEXT CHECK (schedule_status IN ('active', 'canceled', 'released', 'completed'));

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_profiles_schedule_id ON profiles(stripe_schedule_id);
CREATE INDEX IF NOT EXISTS idx_profiles_schedule_status ON profiles(schedule_status);

-- Verificar que las columnas se crearon correctamente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('stripe_schedule_id', 'scheduled_plan_id', 'schedule_start_date', 'schedule_status')
ORDER BY column_name; 