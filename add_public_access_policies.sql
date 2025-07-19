-- Agregar políticas de acceso público para los reportes contables
-- Esto permite que el contable acceda a los reportes sin autenticación

-- Política para permitir acceso público de solo lectura a los reportes (para el contable)
-- Esto permite que cualquiera con el enlace pueda ver el reporte sin autenticación
CREATE POLICY "Public read access for reports" ON accounting_reports
  FOR SELECT USING (true);

-- Política para permitir actualización pública del status (para marcar como visto)
CREATE POLICY "Public update status" ON accounting_reports
  FOR UPDATE USING (true)
  WITH CHECK (true);
