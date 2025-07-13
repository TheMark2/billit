import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encrypt } from '@/utils/encryption';

export async function POST(request: NextRequest) {
  try {
    const { apiKey, testMode = false } = await request.json();

    // Validar que se proporcione el API key
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return NextResponse.json(
        { error: 'API key es requerida' },
        { status: 400 }
      );
    }

    // Obtener token de autorización
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de autorización requerido' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Crear cliente autenticado con el token del usuario
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // Verificar el usuario con Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Token de autorización inválido' },
        { status: 401 }
      );
    }

    // Encriptar el API key
    const encryptedApiKey = encrypt(apiKey.trim());

    // Desactivar credenciales existentes
    await supabase
      .from('holded_credentials')
      .update({ is_active: false })
      .eq('user_id', user.id);

    // Insertar las nuevas credenciales
    const { error: insertError } = await supabase
      .from('holded_credentials')
      .insert({
        user_id: user.id,
        api_key: encryptedApiKey,
        test_mode: testMode,
        is_active: true
      });

    if (insertError) {
      console.error('Error insertando credenciales de Holded:', insertError);
      return NextResponse.json(
        { error: 'Error guardando credenciales' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Credenciales de Holded guardadas exitosamente' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error en save-credentials:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 