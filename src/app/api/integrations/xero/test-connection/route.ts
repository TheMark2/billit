import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { access_token } = await request.json();

    if (!access_token) {
      return NextResponse.json({ 
        error: 'Access token requerido' 
      }, { status: 400 });
    }

    // Primero obtener las organizaciones del usuario
    const orgResponse = await fetch('https://api.xero.com/connections', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json',
      },
    });

    if (!orgResponse.ok) {
      console.error('Error obteniendo organizaciones:', orgResponse.status, orgResponse.statusText);
      
      if (orgResponse.status === 401) {
        return NextResponse.json({ 
          error: 'Token de acceso inválido o expirado.' 
        }, { status: 401 });
      }
      
      return NextResponse.json({ 
        error: `Error de conexión con Xero: ${orgResponse.status}` 
      }, { status: orgResponse.status });
    }

    const orgData = await orgResponse.json();
    
    if (!orgData || orgData.length === 0) {
      return NextResponse.json({ 
        error: 'No se encontraron organizaciones conectadas' 
      }, { status: 404 });
    }

    // Usar la primera organización para probar la API
    const tenantId = orgData[0].tenantId;
    const tenantName = orgData[0].tenantName;

    // Hacer una llamada de prueba a la API de Xero (obtener contactos)
    const testResponse = await fetch('https://api.xero.com/api.xro/2.0/Contacts', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Xero-tenant-id': tenantId,
        'Accept': 'application/json',
      },
    });

    if (!testResponse.ok) {
      console.error('Error en test de API:', testResponse.status, testResponse.statusText);
      
      if (testResponse.status === 401) {
        return NextResponse.json({ 
          error: 'Token de acceso inválido o expirado.' 
        }, { status: 401 });
      }
      
      if (testResponse.status === 403) {
        return NextResponse.json({ 
          error: 'Acceso denegado. Verifica los permisos de tu aplicación.' 
        }, { status: 403 });
      }
      
      return NextResponse.json({ 
        error: `Error de API de Xero: ${testResponse.status}` 
      }, { status: testResponse.status });
    }

    const testData = await testResponse.json();
    
    return NextResponse.json({
      success: true,
      message: 'Conexión con Xero verificada correctamente',
      data: {
        tenantId,
        tenantName,
        contactCount: testData.Contacts?.length || 0,
        status: 'connected'
      }
    });

  } catch (error) {
    console.error('Error en test-connection:', error);
    
    // Manejar errores específicos de red
    if (error instanceof Error && error.message.includes('fetch')) {
      return NextResponse.json({ 
        error: 'Error de red. No se pudo conectar con Xero.' 
      }, { status: 503 });
    }
    
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
} 