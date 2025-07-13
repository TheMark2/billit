import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Configuración OAuth de Xero
const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID;
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET;
const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize';
const XERO_SCOPES = 'openid profile email accounting.transactions accounting.contacts accounting.settings offline_access';

export async function POST(request: NextRequest) {
  try {
    // Verificar variables de entorno
    if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) {
      return NextResponse.json({ 
        error: 'Configuración de Xero no encontrada' 
      }, { status: 500 });
    }

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

    const { userId, redirectUri } = await request.json();
    
    if (!userId || !redirectUri) {
      return NextResponse.json({ 
        error: 'userId y redirectUri son requeridos' 
      }, { status: 400 });
    }

    // Generar PKCE code verifier y challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Generar state para seguridad
    const state = crypto.randomBytes(32).toString('base64url');

    // Almacenar temporalmente el code verifier y state
    await supabase
      .from('xero_oauth_states')
      .upsert({
        user_id: userId,
        state: state,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutos
      });

    // Construir URL de autorización
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: XERO_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: XERO_SCOPES,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `${XERO_AUTH_URL}?${params.toString()}`;

    return NextResponse.json({ 
      authUrl,
      state,
      success: true 
    });

  } catch (error) {
    console.error('Error en auth-url:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
} 