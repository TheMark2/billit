import { NextResponse } from 'next/server';
import { decrypt } from '@/utils/encryption';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  try {
    console.log('🔍 Testing Odoo connection...');
    
    // Obtener las credenciales de Odoo de la base de datos
    const { data: credentials, error } = await supabase
      .from('odoo_credentials')
      .select('*')
      .limit(1)
      .single();

    if (error || !credentials) {
      console.error('❌ Error getting credentials:', error);
      return NextResponse.json({ error: 'No credentials found' }, { status: 404 });
    }

    console.log('✅ Credentials found:', {
      id: credentials.id,
      user_id: credentials.user_id,
      url: credentials.url,
      database: credentials.database,
      username: credentials.username,
      created_at: credentials.created_at
    });

    // Desencriptar la contraseña
    const decryptedPassword = decrypt(credentials.password);
    console.log('🔓 Password decrypted successfully');

    // Configurar la conexión a Odoo
    const odooConfig = {
      url: credentials.url,
      database: credentials.database,
      username: credentials.username,
      password: decryptedPassword
    };

    console.log('🔧 Odoo config:', {
      ...odooConfig,
      password: '[HIDDEN]'
    });

    // Hacer una petición de prueba a Odoo
    const authResponse = await fetch(`${credentials.url}/web/session/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: credentials.database,
          login: credentials.username,
          password: decryptedPassword
        },
        id: Math.random()
      })
    });

    console.log('📡 Auth response status:', authResponse.status);
    
    if (!authResponse.ok) {
      console.error('❌ Auth request failed:', authResponse.statusText);
      return NextResponse.json({ 
        error: 'Authentication failed', 
        status: authResponse.status 
      }, { status: 400 });
    }

    const authData = await authResponse.json() as any;
    console.log('✅ Auth response:', authData);

    if (authData.error) {
      console.error('❌ Odoo auth error:', authData.error);
      return NextResponse.json({ 
        error: 'Odoo authentication error', 
        details: authData.error 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Odoo connection successful',
      config: {
        ...odooConfig,
        password: '[HIDDEN]'
      },
      authData: authData
    });

  } catch (error) {
    console.error('❌ Error testing Odoo connection:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 