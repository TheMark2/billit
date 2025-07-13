import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Obtener el token de autorización del header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Crear cliente de Supabase con el token del usuario
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

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Obtener datos del body
    const body = await request.json();
    const { userId, url, database, username, password } = body;

    if (!userId || !url || !database || !username || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verificar que el userId coincida con el usuario autenticado
    if (userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - User ID mismatch' },
        { status: 403 }
      );
    }

    // Probar la conexión con Odoo antes de guardar
    const testResult = await testOdooConnection({ url, database, username, password });
    if (!testResult.success) {
      return NextResponse.json(
        { error: `Error de conexión con Odoo: ${testResult.error}` },
        { status: 400 }
      );
    }

    // Crear cliente de Supabase con service role para insertar credenciales
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Upsert (insertar o actualizar) las credenciales de Odoo
    const { error: upsertError } = await supabaseAdmin
      .from('odoo_credentials')
      .upsert({
        user_id: userId,
        url: url,
        database: database,
        username: username,
        password: password, // En un entorno real, esto debería estar encriptado
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      console.error('Error saving Odoo credentials:', upsertError);
      return NextResponse.json(
        { error: 'Error saving credentials' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Credenciales de Odoo guardadas correctamente'
    });

  } catch (error) {
    console.error('Error in save-credentials:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Función para probar la conexión con Odoo
async function testOdooConnection(credentials: {
  url: string;
  database: string;
  username: string;
  password: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Normalizar la URL
    let apiUrl = credentials.url.trim().replace(/\/$/, ''); // Quitar slash final y espacios
    
    // Agregar protocolo si no existe
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      apiUrl = 'https://' + apiUrl;
    }

    console.log('Testing Odoo connection to:', apiUrl);

    // Primero probar si el servidor está disponible
    try {
      const pingResponse = await fetch(`${apiUrl}/web/database/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(10000) // 10 segundos timeout
      });
      
      console.log('Ping response status:', pingResponse.status);
    } catch (pingError) {
      console.error('Ping error:', pingError);
      throw new Error(`No se puede conectar al servidor Odoo en ${apiUrl}. Verifica que la URL sea correcta y esté accesible.`);
    }

    // Crear el XML para la autenticación
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param>
      <value><string>${credentials.database}</string></value>
    </param>
    <param>
      <value><string>${credentials.username}</string></value>
    </param>
    <param>
      <value><string>${credentials.password}</string></value>
    </param>
    <param>
      <value><struct></struct></value>
    </param>
  </params>
</methodCall>`;

    console.log('Sending XML-RPC request to:', `${apiUrl}/xmlrpc/2/common`);

    // Probar autenticación con Odoo usando XML-RPC
    const authResponse = await fetch(`${apiUrl}/xmlrpc/2/common`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'User-Agent': 'ReciptAI/1.0',
        'Accept': 'text/xml',
      },
      body: xmlBody,
      signal: AbortSignal.timeout(15000) // 15 segundos timeout
    });

    console.log('Auth response status:', authResponse.status);
    console.log('Auth response headers:', Object.fromEntries(authResponse.headers.entries()));

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('Auth response error:', errorText);
      throw new Error(`Error del servidor Odoo (${authResponse.status}): ${authResponse.statusText}`);
    }

    const responseText = await authResponse.text();
    console.log('Auth response body:', responseText);
    
    // Verificar si hay errores en la respuesta XML
    if (responseText.includes('<fault>')) {
      // Extraer el mensaje de error del XML
      const faultMatch = responseText.match(/<string>([^<]+)<\/string>/);
      const errorMessage = faultMatch ? faultMatch[1] : 'Error de autenticación';
      throw new Error(`Error de Odoo: ${errorMessage}`);
    }

    // Verificar si la autenticación devolvió False
    if (responseText.includes('<boolean>0</boolean>') || responseText.includes('<boolean>false</boolean>')) {
      throw new Error('Credenciales inválidas. Verifica tu nombre de usuario, contraseña y base de datos.');
    }

    // Verificar si tenemos un user ID válido en la respuesta
    const userIdMatch = responseText.match(/<(?:int|i4)>(\d+)<\/(?:int|i4)>/);
    if (!userIdMatch) {
      throw new Error('Respuesta de autenticación inesperada de Odoo. Verifica la configuración.');
    }

    const userId = parseInt(userIdMatch[1]);
    if (userId <= 0) {
      throw new Error('Usuario no válido en Odoo');
    }

    console.log('Authentication successful, user ID:', userId);
    return { success: true };

  } catch (error) {
    console.error('Error testing Odoo connection:', error);
    
    if (error instanceof Error) {
      // Mejorar mensajes de error específicos
      if (error.message.includes('fetch')) {
        return { 
          success: false, 
          error: 'No se puede conectar al servidor. Verifica que la URL sea correcta y que el servidor esté accesible.'
        };
      }
      
      if (error.message.includes('timeout')) {
        return { 
          success: false, 
          error: 'Tiempo de espera agotado. El servidor Odoo no responde.'
        };
      }
      
      return { 
        success: false, 
        error: error.message
      };
    }
    
    return { 
      success: false, 
      error: 'Error de conexión desconocido'
    };
  }
} 