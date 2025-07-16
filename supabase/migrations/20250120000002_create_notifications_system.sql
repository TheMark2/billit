-- Crear tabla de notificaciones
-- Fecha: 2025-01-20

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'success',      -- Procesamiento exitoso
        'error',        -- Error en procesamiento  
        'warning',      -- Advertencias
        'info',         -- Información general
        'payment',      -- Relacionado con pagos
        'subscription', -- Relacionado con suscripciones
        'integration',  -- Relacionado con integraciones
        'limit',        -- Límites alcanzados
        'welcome'       -- Bienvenida/onboarding
    )),
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT, -- URL opcional para acciones
    metadata JSONB DEFAULT '{}', -- Datos adicionales
    receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL, -- Recibo relacionado (opcional)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- Habilitar RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON notifications
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can delete their own notifications" ON notifications
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Función para crear notificaciones automáticamente
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_title VARCHAR(255),
    p_message TEXT,
    p_type VARCHAR(50),
    p_action_url TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_receipt_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    notification_id UUID;
BEGIN
    INSERT INTO notifications (
        user_id, title, message, type, action_url, metadata, receipt_id
    ) VALUES (
        p_user_id, p_title, p_message, p_type, p_action_url, p_metadata, p_receipt_id
    ) RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$;

-- Función para marcar notificaciones como leídas
CREATE OR REPLACE FUNCTION mark_notifications_as_read(
    p_user_id UUID,
    p_notification_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    IF p_notification_ids IS NULL THEN
        -- Marcar todas las notificaciones del usuario como leídas
        UPDATE notifications 
        SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = p_user_id AND is_read = FALSE;
        
        GET DIAGNOSTICS affected_count = ROW_COUNT;
    ELSE
        -- Marcar notificaciones específicas como leídas
        UPDATE notifications 
        SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = p_user_id AND id = ANY(p_notification_ids) AND is_read = FALSE;
        
        GET DIAGNOSTICS affected_count = ROW_COUNT;
    END IF;
    
    RETURN affected_count;
END;
$$;

-- Función para limpiar notificaciones antiguas (ejecutar mensualmente)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER := 0;
    temp_count INTEGER;
BEGIN
    -- Eliminar notificaciones leídas de más de 30 días
    DELETE FROM notifications 
    WHERE is_read = TRUE 
    AND created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Eliminar notificaciones no leídas de más de 90 días
    DELETE FROM notifications 
    WHERE is_read = FALSE 
    AND created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    RETURN deleted_count;
END;
$$;

-- Insertar notificaciones de ejemplo para usuarios existentes
INSERT INTO notifications (user_id, title, message, type, metadata)
SELECT 
    p.id,
    '¡Bienvenido a ReciptAI!',
    'Tu cuenta está configurada. Comienza subiendo tu primer ticket para procesarlo automáticamente.',
    'welcome',
    '{"onboarding": true}'::jsonb
FROM profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM notifications n WHERE n.user_id = p.id AND n.type = 'welcome'
);

-- Comentario sobre automatización
COMMENT ON FUNCTION create_notification IS 'Función para crear notificaciones desde APIs y triggers automáticamente';
COMMENT ON FUNCTION mark_notifications_as_read IS 'Función para marcar notificaciones como leídas';
COMMENT ON FUNCTION cleanup_old_notifications IS 'Función para limpiar notificaciones antiguas - configurar como cron job mensual'; 