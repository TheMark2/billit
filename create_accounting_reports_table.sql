-- Crear tabla para reportes contables
CREATE TABLE IF NOT EXISTS accounting_reports (
  id TEXT PRIMARY KEY,
  report_data JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'processed')),
  accessed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_accounting_reports_created_by ON accounting_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_accounting_reports_created_at ON accounting_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_accounting_reports_status ON accounting_reports(status);

-- Habilitar RLS (Row Level Security)
ALTER TABLE accounting_reports ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios solo puedan ver sus propios reportes
CREATE POLICY "Users can view their own reports" ON accounting_reports
  FOR SELECT USING (created_by = auth.uid());

-- Política para que los usuarios puedan crear reportes
CREATE POLICY "Users can create reports" ON accounting_reports
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- Política para que los usuarios puedan actualizar sus propios reportes
CREATE POLICY "Users can update their own reports" ON accounting_reports
  FOR UPDATE USING (created_by = auth.uid());

-- Política para permitir acceso público de solo lectura a los reportes (para el contable)
-- Esto permite que cualquiera con el enlace pueda ver el reporte sin autenticación
CREATE POLICY "Public read access for reports" ON accounting_reports
  FOR SELECT USING (true);

-- Política para permitir actualización pública del status (para marcar como visto)
CREATE POLICY "Public update status" ON accounting_reports
  FOR UPDATE USING (true)
  WITH CHECK (true);
