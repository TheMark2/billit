import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encrypt } from '@/utils/encryption';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Configuración OAuth de Xero
const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID;
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET;
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';

export async function GET(request: NextRequest) {
  try {
    // Verificar variables de entorno
    if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) {
      return NextResponse.redirect(new URL('/dashboard/integraciones?error=config', request.url));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Manejar errores de OAuth
    if (error) {
      console.error('Error OAuth de Xero:', error);
      return NextResponse.redirect(new URL(`/dashboard/integraciones?error=${error}`, request.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/dashboard/integraciones?error=missing_params', request.url));
    }

    // Usar service role para obtener el state almacenado
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar el state y obtener el code verifier
    const { data: stateData, error: stateError } = await supabase
      .from('xero_oauth_states')
      .select('*')
      .eq('state', state)
      .single();

    if (stateError || !stateData) {
      console.error('State no encontrado o inválido:', stateError);
      return NextResponse.redirect(new URL('/dashboard/integraciones?error=invalid_state', request.url));
    }

    // Verificar que el state no haya expirado
    if (new Date(stateData.expires_at) < new Date()) {
      await supabase.from('xero_oauth_states').delete().eq('state', state);
      return NextResponse.redirect(new URL('/dashboard/integraciones?error=expired_state', request.url));
    }

    // Intercambiar código por tokens
    const tokenResponse = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: stateData.redirect_uri,
        code_verifier: stateData.code_verifier,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Error intercambiando código por tokens:', errorData);
      return NextResponse.redirect(new URL('/dashboard/integraciones?error=token_exchange', request.url));
    }

    const tokenData = await tokenResponse.json();

    // Encriptar tokens
    const encryptedAccessToken = encrypt(tokenData.access_token);
    const encryptedRefreshToken = encrypt(tokenData.refresh_token);

    // Guardar credenciales en la base de datos
    const { error: saveError } = await supabase
      .from('xero_credentials')
      .upsert({
        user_id: stateData.user_id,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        scope: tokenData.scope,
        updated_at: new Date().toISOString(),
      });

    if (saveError) {
      console.error('Error guardando credenciales:', saveError);
      return NextResponse.redirect(new URL('/dashboard/integraciones?error=save_credentials', request.url));
    }

    // Limpiar el state temporal
    await supabase.from('xero_oauth_states').delete().eq('state', state);

    // Redirigir al dashboard con éxito
    return NextResponse.redirect(new URL('/dashboard/integraciones?success=xero_connected', request.url));

  } catch (error) {
    console.error('Error en callback de Xero:', error);
    return NextResponse.redirect(new URL('/dashboard/integraciones?error=internal_error', request.url));
  }
} 