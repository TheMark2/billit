import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encrypt } from '@/utils/encryption';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

export async function POST(request: NextRequest) {
  try {
    // Crear cliente Supabase con el token del usuario
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Verificar el usuario
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Obtener datos del request
    const { access_token, refresh_token, token_type, expires_in, scope } = await request.json();

    if (!access_token || !refresh_token) {
      return NextResponse.json({ 
        error: 'Faltan datos requeridos: access_token y refresh_token' 
      }, { status: 400 });
    }

    // Encriptar tokens
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = encrypt(refresh_token);

    // Guardar credenciales en la base de datos
    const { error: insertError } = await supabase
      .from('xero_credentials')
      .upsert({
        user_id: user.id,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_type: token_type || 'Bearer',
        expires_in: expires_in || 1800, // 30 minutos por defecto
        scope: scope || '',
        updated_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Error al guardar en DB:', insertError);
      return NextResponse.json({ 
        error: 'Error al guardar credenciales' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Credenciales de Xero guardadas correctamente',
      success: true
    });

  } catch (error) {
    console.error('Error en save-credentials:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
} 