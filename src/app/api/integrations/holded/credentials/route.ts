import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { decrypt } from '@/utils/encryption';

export async function GET(request: NextRequest) {
  try {
    // Obtener token de autorización
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de autorización requerido' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verificar el usuario con Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Token de autorización inválido' },
        { status: 401 }
      );
    }

    // Obtener credenciales activas del usuario
    const { data: credentials, error: fetchError } = await supabase
      .from('holded_credentials')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = No rows found
      console.error('Error obteniendo credenciales de Holded:', fetchError);
      return NextResponse.json(
        { error: 'Error obteniendo credenciales' },
        { status: 500 }
      );
    }

    if (!credentials) {
      return NextResponse.json(
        { hasCredentials: false },
        { status: 200 }
      );
    }

    // Desencriptar el API key
    let apiKey;
    try {
      apiKey = decrypt(credentials.api_key);
    } catch (decryptError) {
      console.error('Error desencriptando API key de Holded:', decryptError);
      return NextResponse.json(
        { error: 'Error procesando credenciales' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      hasCredentials: true,
      testMode: credentials.test_mode,
      // Solo devolver información parcial del API key por seguridad
      apiKeyPreview: `${apiKey.substring(0, 8)}...`,
      lastUpdated: credentials.updated_at
    });

  } catch (error) {
    console.error('Error en credentials:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 