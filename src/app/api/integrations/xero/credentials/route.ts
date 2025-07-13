import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from '@/utils/encryption';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación N8N
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // Verificar si es token N8N
    if (token !== process.env.N8N_API_TOKEN) {
      return NextResponse.json({ error: 'Token N8N inválido' }, { status: 401 });
    }

    // Obtener user_id de los query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: 'user_id requerido' }, { status: 400 });
    }

    // Usar service role para obtener las credenciales
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('xero_credentials')
      .select('access_token, refresh_token, token_type, expires_in, scope')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error al obtener credenciales:', error);
      return NextResponse.json({ error: 'Credenciales no encontradas' }, { status: 404 });
    }

    // Desencriptar tokens
    const decryptedAccessToken = decrypt(data.access_token);
    const decryptedRefreshToken = decrypt(data.refresh_token);

    return NextResponse.json({
      access_token: decryptedAccessToken,
      refresh_token: decryptedRefreshToken,
      token_type: data.token_type,
      expires_in: data.expires_in,
      scope: data.scope,
      success: true
    });

  } catch (error) {
    console.error('Error en credentials:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
} 