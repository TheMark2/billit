-- Mejorar el manejo de usuarios OAuth
-- Eliminar el trigger anterior si existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Eliminar la función anterior si existe
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Crear una función mejorada para manejar nuevos usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_plan_id UUID;
BEGIN
    -- Obtener el ID del plan básico
    SELECT id INTO default_plan_id FROM plans WHERE nombre = 'Básico' LIMIT 1;
    
    -- Insertar el perfil del usuario
    INSERT INTO public.profiles (
        id, 
        email, 
        nombre, 
        apellido,
        plan_id,
        is_subscribed,
        recibos_mes_actual
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'),
        COALESCE(
            NEW.raw_user_meta_data->>'nombre',
            NEW.raw_user_meta_data->>'name',
            NEW.raw_user_meta_data->>'full_name',
            split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), ' ', 1)
        ),
        COALESCE(
            NEW.raw_user_meta_data->>'apellido',
            CASE 
                WHEN NEW.raw_user_meta_data->>'full_name' IS NOT NULL 
                AND array_length(string_to_array(NEW.raw_user_meta_data->>'full_name', ' '), 1) > 1
                THEN split_part(NEW.raw_user_meta_data->>'full_name', ' ', 2)
                ELSE NULL
            END
        ),
        default_plan_id,
        false,
        0
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log del error pero no fallar la creación del usuario
        RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ language 'plpgsql';

-- Crear el trigger mejorado
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Asegurar que las políticas RLS estén correctas
DROP POLICY IF EXISTS "Enable insert for service role" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;

-- Política para permitir inserción durante el registro
CREATE POLICY "Enable insert for new users"
    ON profiles FOR INSERT
    WITH CHECK (true);

-- Política para que los usuarios vean su propio perfil
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- Política para que los usuarios actualicen su propio perfil
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Asegurar que existe al menos un plan básico
INSERT INTO plans (nombre, descripcion, limite_recibos, precio) VALUES
('Básico', 'Plan básico con límite de 50 recibos mensuales', 50, 0)
ON CONFLICT (nombre) DO NOTHING;