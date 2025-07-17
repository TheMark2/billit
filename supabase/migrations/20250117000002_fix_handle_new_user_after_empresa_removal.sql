-- Fix handle_new_user function after empresa column removal
-- Date: 2025-01-17
-- This migration ensures the handle_new_user function works correctly after empresa dependencies were removed

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create updated function without empresa references
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_plan_id UUID;
BEGIN
    -- Get the basic plan ID
    SELECT id INTO default_plan_id FROM plans WHERE nombre = 'Básico' LIMIT 1;
    
    -- Insert user profile with current table structure
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
            NEW.raw_user_meta_data->>'given_name',
            split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), ' ', 1),
            'Usuario'
        ),
        COALESCE(
            NEW.raw_user_meta_data->>'apellido',
            NEW.raw_user_meta_data->>'family_name',
            CASE 
                WHEN NEW.raw_user_meta_data->>'full_name' IS NOT NULL 
                AND array_length(string_to_array(NEW.raw_user_meta_data->>'full_name', ' '), 1) > 1
                THEN array_to_string(
                    (string_to_array(NEW.raw_user_meta_data->>'full_name', ' '))[2:], 
                    ' '
                )
                ELSE ''
            END
        ),
        default_plan_id,
        false,
        0
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail user creation
        RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ language 'plpgsql';

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure RLS policies are correct
DROP POLICY IF EXISTS "Enable insert for service role" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for new users" ON profiles;

-- Policy to allow insertion during registration
CREATE POLICY "Enable insert for new users"
    ON profiles FOR INSERT
    WITH CHECK (true);

-- Policy for users to view their own profile
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- Policy for users to update their own profile
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Ensure basic plan exists
INSERT INTO plans (nombre, descripcion, limite_recibos, precio) VALUES
('Básico', 'Plan básico con límite de 50 recibos mensuales', 50, 0)
ON CONFLICT (nombre) DO NOTHING;

-- Comment on the function
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates user profile when new user signs up via OAuth or email';