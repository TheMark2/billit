-- Migración para sistema de organización de tickets con carpetas
-- ========================================================================

-- 1. Crear tabla de carpetas/categorías
CREATE TABLE IF NOT EXISTS ticket_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES ticket_folders(id) ON DELETE CASCADE,
    icon_name VARCHAR(50) DEFAULT 'folder',
    color VARCHAR(20) DEFAULT 'blue',
    is_expanded BOOLEAN DEFAULT true,
    "position" INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Crear índices para ticket_folders
CREATE INDEX IF NOT EXISTS idx_ticket_folders_user_id ON ticket_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_folders_parent_id ON ticket_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_ticket_folders_position ON ticket_folders(user_id, "position");

-- 3. Añadir columna folder_id a la tabla receipts
ALTER TABLE receipts 
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES ticket_folders(id) ON DELETE SET NULL;

-- 4. Crear índice para folder_id en receipts
CREATE INDEX IF NOT EXISTS idx_receipts_folder_id ON receipts(folder_id);

-- 5. Habilitar RLS para ticket_folders
ALTER TABLE ticket_folders ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS para ticket_folders (con DROP IF EXISTS para idempotencia)
DROP POLICY IF EXISTS "Users can view their own folders" ON ticket_folders;
CREATE POLICY "Users can view their own folders"
    ON ticket_folders FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own folders" ON ticket_folders;
CREATE POLICY "Users can insert their own folders"
    ON ticket_folders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own folders" ON ticket_folders;
CREATE POLICY "Users can update their own folders"
    ON ticket_folders FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own folders" ON ticket_folders;
CREATE POLICY "Users can delete their own folders"
    ON ticket_folders FOR DELETE
    USING (auth.uid() = user_id);

-- 7. Función para obtener la jerarquía completa de carpetas
CREATE OR REPLACE FUNCTION get_folder_hierarchy(user_id_param UUID)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    description TEXT,
    parent_id UUID,
    icon_name VARCHAR(50),
    color VARCHAR(20),
    is_expanded BOOLEAN,
    "position" INTEGER,
    level INTEGER,
    path TEXT[],
    ticket_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE folder_tree AS (
        -- Nodos raíz (sin parent_id)
        SELECT 
            tf.id,
            tf.name,
            tf.description,
            tf.parent_id,
            tf.icon_name,
            tf.color,
            tf.is_expanded,
            tf."position",
            0 as level,
            ARRAY[tf.name]::TEXT[] as path,
            (
                SELECT COUNT(*)::INTEGER 
                FROM receipts r 
                WHERE r.folder_id = tf.id AND r.user_id = user_id_param
            ) as ticket_count
        FROM ticket_folders tf
        WHERE tf.user_id = user_id_param 
        AND tf.parent_id IS NULL
        
        UNION ALL
        
        -- Nodos hijos (recursivo)
        SELECT 
            tf.id,
            tf.name,
            tf.description,
            tf.parent_id,
            tf.icon_name,
            tf.color,
            tf.is_expanded,
            tf."position",
            ft.level + 1,
            ft.path || tf.name,
            (
                SELECT COUNT(*)::INTEGER 
                FROM receipts r 
                WHERE r.folder_id = tf.id AND r.user_id = user_id_param
            ) as ticket_count
        FROM ticket_folders tf
        INNER JOIN folder_tree ft ON tf.parent_id = ft.id
        WHERE tf.user_id = user_id_param
    )
    SELECT 
        folder_tree.id,
        folder_tree.name,
        folder_tree.description,
        folder_tree.parent_id,
        folder_tree.icon_name,
        folder_tree.color,
        folder_tree.is_expanded,
        folder_tree."position",
        folder_tree.level,
        folder_tree.path,
        folder_tree.ticket_count
    FROM folder_tree
    ORDER BY folder_tree.level, folder_tree."position", folder_tree.name;
END;
$$;

-- 8. Función para mover tickets entre carpetas
CREATE OR REPLACE FUNCTION move_tickets_to_folder(
    ticket_ids UUID[],
    target_folder_id UUID,
    user_id_param UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Verificar que la carpeta pertenece al usuario (si no es NULL)
    IF target_folder_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM ticket_folders 
            WHERE id = target_folder_id AND user_id = user_id_param
        ) THEN
            RAISE EXCEPTION 'Folder does not exist or does not belong to user';
        END IF;
    END IF;
    
    -- Actualizar los tickets
    UPDATE receipts 
    SET folder_id = target_folder_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ANY(ticket_ids) 
    AND user_id = user_id_param;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RETURN updated_count;
END;
$$;

-- 9. Función para reorganizar posiciones de carpetas
CREATE OR REPLACE FUNCTION reorder_folders(
    folder_positions JSONB,
    user_id_param UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    folder_item JSONB;
    updated_count INTEGER := 0;
BEGIN
    -- Iterar sobre las posiciones proporcionadas
    FOR folder_item IN SELECT * FROM jsonb_array_elements(folder_positions)
    LOOP
        UPDATE ticket_folders 
        SET "position" = (folder_item->>'position')::INTEGER,
            parent_id = CASE 
                WHEN folder_item->>'parent_id' = 'null' OR folder_item->>'parent_id' IS NULL 
                THEN NULL 
                ELSE (folder_item->>'parent_id')::UUID 
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = (folder_item->>'id')::UUID 
        AND user_id = user_id_param;
        
        updated_count := updated_count + 1;
    END LOOP;
    
    RETURN updated_count > 0;
END;
$$;

-- 10. Insertar carpetas por defecto para usuarios existentes (solo si no existen)
DO $$
DECLARE
    user_record RECORD;
    folder_exists BOOLEAN;
BEGIN
    FOR user_record IN SELECT id FROM auth.users LOOP
        -- Verificar si el usuario ya tiene alguna carpeta
        SELECT EXISTS(
            SELECT 1 FROM ticket_folders 
            WHERE user_id = user_record.id 
            LIMIT 1
        ) INTO folder_exists;
        
        -- Solo crear carpetas si no existen
        IF NOT folder_exists THEN
        -- Carpeta "Sin categorizar" por defecto
        INSERT INTO ticket_folders (user_id, name, description, icon_name, color, "position")
        VALUES (
            user_record.id,
            'Sin categorizar',
            'Tickets que no han sido organizados en ninguna carpeta específica',
            'inbox',
            'gray',
            0
        );
        
        -- Carpeta "Gastos de oficina"
        INSERT INTO ticket_folders (user_id, name, description, icon_name, color, "position")
        VALUES (
            user_record.id,
            'Gastos de oficina',
            'Material de oficina, suministros y equipamiento',
            'building-office',
            'blue',
            1
        );
        
        -- Carpeta "Comidas y restaurantes"
        INSERT INTO ticket_folders (user_id, name, description, icon_name, color, "position")
        VALUES (
            user_record.id,
            'Comidas y restaurantes',
            'Gastos en restaurantes, comidas de trabajo y catering',
            'utensils',
            'green',
            2
        );
        
        -- Carpeta "Transporte"
        INSERT INTO ticket_folders (user_id, name, description, icon_name, color, "position")
        VALUES (
            user_record.id,
            'Transporte',
            'Gasolina, peajes, parking, taxis y transporte público',
            'car',
            'orange',
            3
        );
        
        -- Carpeta "Servicios profesionales"
        INSERT INTO ticket_folders (user_id, name, description, icon_name, color, "position")
        VALUES (
            user_record.id,
            'Servicios profesionales',
            'Asesorías, consultorías, servicios legales y contables',
            'briefcase',
            'purple',
            4
        );
        
        END IF; -- Cerrar el IF NOT folder_exists
    END LOOP;
END;
$$;

-- 11. Función trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_folder_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Crear trigger para actualizar updated_at en ticket_folders (con DROP IF EXISTS)
DROP TRIGGER IF EXISTS update_ticket_folders_updated_at ON ticket_folders;
CREATE TRIGGER update_ticket_folders_updated_at
    BEFORE UPDATE ON ticket_folders
    FOR EACH ROW
    EXECUTE FUNCTION update_folder_updated_at(); 