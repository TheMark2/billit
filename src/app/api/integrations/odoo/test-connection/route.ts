import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, database, username, password } = body;

    if (!url || !database || !username || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Normalizar la URL
    let apiUrl = url.trim().replace(/\/$/, ''); // Quitar slash final y espacios
    
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
      return NextResponse.json(
        { error: `No se puede conectar al servidor Odoo en ${apiUrl}. Verifica que la URL sea correcta y esté accesible.` },
        { status: 400 }
      );
    }

    // Crear el XML para la autenticación
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param>
      <value><string>${database}</string></value>
    </param>
    <param>
      <value><string>${username}</string></value>
    </param>
    <param>
      <value><string>${password}</string></value>
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
      return NextResponse.json(
        { error: `Error del servidor Odoo (${authResponse.status}): ${authResponse.statusText}` },
        { status: 400 }
      );
    }

    const responseText = await authResponse.text();
    console.log('Auth response body:', responseText);
    
    // Verificar si hay errores en la respuesta XML
    if (responseText.includes('<fault>')) {
      // Extraer el mensaje de error del XML
      const faultMatch = responseText.match(/<string>([^<]+)<\/string>/);
      const errorMessage = faultMatch ? faultMatch[1] : 'Error de autenticación';
      return NextResponse.json(
        { error: `Error de Odoo: ${errorMessage}` },
        { status: 400 }
      );
    }

    // Verificar si la autenticación devolvió False
    if (responseText.includes('<boolean>0</boolean>') || responseText.includes('<boolean>false</boolean>')) {
      return NextResponse.json(
        { error: 'Credenciales inválidas. Verifica tu nombre de usuario, contraseña y base de datos.' },
        { status: 400 }
      );
    }

    // Verificar si tenemos un user ID válido en la respuesta
    const userIdMatch = responseText.match(/<(?:int|i4)>(\d+)<\/(?:int|i4)>/);
    if (!userIdMatch) {
      return NextResponse.json(
        { error: 'Respuesta de autenticación inesperada de Odoo. Verifica la configuración.' },
        { status: 400 }
      );
    }

    const userId = parseInt(userIdMatch[1]);
    if (userId <= 0) {
      return NextResponse.json(
        { error: 'Usuario no válido en Odoo' },
        { status: 400 }
      );
    }

    console.log('Authentication successful, user ID:', userId);

    return NextResponse.json({ 
      success: true,
      message: 'Conexión exitosa con Odoo',
      userId: userId,
      database: database,
      url: apiUrl
    });

  } catch (error) {
    console.error('Error testing Odoo connection:', error);
    
    if (error instanceof Error) {
      // Mejorar mensajes de error específicos
      if (error.message.includes('fetch')) {
        return NextResponse.json(
          { error: 'No se puede conectar al servidor. Verifica que la URL sea correcta y que el servidor esté accesible.' },
          { status: 500 }
        );
      }
      
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Tiempo de espera agotado. El servidor Odoo no responde.' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error de conexión desconocido' },
      { status: 500 }
    );
  }
} 