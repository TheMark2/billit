-- Crear tabla para almacenar los emails de la landing
CREATE TABLE email_signups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source VARCHAR(100) DEFAULT 'landing', -- landing, referral, etc.
  ip_address INET,
  user_agent TEXT,
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100)
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_email_signups_email ON email_signups(email);
CREATE INDEX idx_email_signups_created_at ON email_signups(created_at);
CREATE INDEX idx_email_signups_source ON email_signups(source);

-- RLS (Row Level Security)
ALTER TABLE email_signups ENABLE ROW LEVEL SECURITY;

-- Política para permitir insertar emails (público)
CREATE POLICY "Allow public email signup" ON email_signups
  FOR INSERT WITH CHECK (true);

-- Política para que solo admins puedan ver los emails
CREATE POLICY "Admin can view all signups" ON email_signups
  FOR SELECT USING (false); -- Por ahora no permitimos lectura pública 