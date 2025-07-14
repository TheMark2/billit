import { NextRequest, NextResponse } from 'next/server';

const LOG_PREFIX = '🟢 [HOLDED-TEST]';

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

    console.log(`${LOG_PREFIX} Iniciando test de conexión con Holded...`);
    console.log(`${LOG_PREFIX} API Key: ${apiKey.substring(0, 8)}...`);
    console.log(`${LOG_PREFIX} Modo test: ${testMode}`);

    // Configuración mejorada de la API
    const API_CONFIG = {
      baseUrl: 'https://api.holded.com/api',
      headers: {
        'key': apiKey.trim(),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 segundos timeout
    };

    // Endpoints ordenados por prioridad según documentación oficial de Holded
    const endpoints = [
      {
        url: `${API_CONFIG.baseUrl}/invoicing/v1/documents/purchase`,
        name: 'Facturas de compra',
        description: 'Endpoint principal donde aparecen las facturas de compra digitalizadas',
        priority: 1
      },
      {
        url: `${API_CONFIG.baseUrl}/invoicing/v1/contacts`,
        name: 'Contactos',
        description: 'Endpoint para gestionar contactos/proveedores',
        priority: 2
      },
      {
        url: `${API_CONFIG.baseUrl}/invoicing/v1/documents`,
        name: 'Documentos generales',
        description: 'Listado de todos los tipos de documentos',
        priority: 3
      }
    ];

    console.log(`${LOG_PREFIX} Probando ${endpoints.length} endpoints...`);

    // Probar endpoints con manejo mejorado de errores
    const testResult = await testHoldedEndpoints(endpoints, API_CONFIG);
    
    if (testResult.success) {
      console.log(`${LOG_PREFIX} ✅ Conexión exitosa con endpoint: ${testResult.endpoint.name}`);
      return NextResponse.json({
        success: true,
        message: 'Conexión exitosa con Holded',
        endpoint: testResult.endpoint,
        connection_info: testResult.connectionInfo,
        data_sample: testResult.dataSample,
        holded_integration_guide: {
          donde_aparecen_facturas: 'Facturas → Facturas de compra',
          tipo_documento: 'purchase',
          endpoint_principal: `${API_CONFIG.baseUrl}/invoicing/v1/documents/purchase`,
          configuracion_recomendada: 'Asegúrate de que tu API Key tenga permisos de lectura/escritura en facturas'
        }
      });
    } else {
      console.log(`${LOG_PREFIX} ❌ Error de conexión: ${testResult.error}`);
      return NextResponse.json(
        { error: testResult.error },
        { status: testResult.statusCode || 500 }
      );
    }

  } catch (error) {
    console.error(`${LOG_PREFIX} Error interno:`, error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Función auxiliar para probar endpoints de Holded
async function testHoldedEndpoints(endpoints: any[], apiConfig: any): Promise<any> {
  const LOG_PREFIX = '🟢 [HOLDED-TEST]';
  
  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    console.log(`${LOG_PREFIX} [${i + 1}/${endpoints.length}] Probando: ${endpoint.name}`);
    
    try {
      // Crear controller para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), apiConfig.timeout);
      
      const response = await fetch(endpoint.url, {
        method: 'GET',
        headers: apiConfig.headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log(`${LOG_PREFIX} Status: ${response.status} | Content-Type: ${response.headers.get('content-type')}`);

      // Manejar errores de autenticación inmediatamente
      if (response.status === 401) {
        return {
          success: false,
          error: 'API Key inválida o sin permisos',
          statusCode: 401
        };
      }
      
      if (response.status === 403) {
        return {
          success: false,
          error: 'Acceso denegado - Verifica los permisos de tu API Key',
          statusCode: 403
        };
      }

      // Si la respuesta es exitosa, procesar
      if (response.ok) {
        const responseData = await processHoldedResponse(response, endpoint);
        
        if (responseData.success) {
          return {
            success: true,
            endpoint: endpoint,
            connectionInfo: responseData.connectionInfo,
            dataSample: responseData.dataSample
          };
        }
      }
      
      // Si no es exitosa pero tampoco es error crítico, continuar con siguiente endpoint
      console.log(`${LOG_PREFIX} Endpoint ${endpoint.name} no disponible (${response.status}), probando siguiente...`);
      
    } catch (error: any) {
      console.log(`${LOG_PREFIX} Error en ${endpoint.name}:`, error.message);
      
      // Si es timeout o error de conexión y es el último endpoint, devolver error
      if (i === endpoints.length - 1) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'Timeout conectando con Holded - El servidor no respondió a tiempo',
            statusCode: 408
          };
        }
        
        return {
          success: false,
          error: `Error de conexión con Holded: ${error.message}`,
          statusCode: 500
        };
      }
      
      // Continuar con siguiente endpoint
      continue;
    }
  }

  // Si ningún endpoint funcionó
  return {
    success: false,
    error: 'No se pudo establecer conexión con ningún endpoint de Holded',
    statusCode: 500
  };
}

// Función auxiliar para procesar respuesta de Holded
async function processHoldedResponse(response: Response, endpoint: any): Promise<any> {
  const LOG_PREFIX = '🟢 [HOLDED-TEST]';
  
  try {
    const rawResponse = await response.text();
    console.log(`${LOG_PREFIX} Respuesta recibida (${rawResponse.length} chars)`);

    // Verificar si es HTML (error de endpoint)
    if (rawResponse.includes('<html') || rawResponse.includes('<!DOCTYPE')) {
      console.log(`${LOG_PREFIX} ❌ Respuesta HTML recibida, endpoint no disponible`);
      return { success: false, error: 'Endpoint devolvió HTML' };
    }

    // Verificar si es JSON válido
    if (!rawResponse.trim()) {
      console.log(`${LOG_PREFIX} ❌ Respuesta vacía`);
      return { success: false, error: 'Respuesta vacía' };
    }

    let jsonData;
    try {
      jsonData = JSON.parse(rawResponse);
      console.log(`${LOG_PREFIX} ✅ JSON válido recibido`);
    } catch (parseError) {
      console.log(`${LOG_PREFIX} ❌ JSON inválido:`, parseError);
      return { success: false, error: 'JSON inválido' };
    }

    // Analizar estructura de datos
    const connectionInfo = analyzeHoldedData(jsonData, endpoint);
    
    // Preparar muestra de datos (limitada para seguridad)
    const dataSample = Array.isArray(jsonData) ? 
      jsonData.slice(0, 2).map(item => ({
        id: item.id || 'N/A',
        name: item.name || item.contactName || 'N/A',
        type: item.type || 'N/A',
        date: item.date || item.created_at || 'N/A'
      })) : 
      {
        hasData: Object.keys(jsonData).length > 0,
        properties: Object.keys(jsonData).slice(0, 5)
      };

    return {
      success: true,
      connectionInfo,
      dataSample
    };

  } catch (error: any) {
    console.log(`${LOG_PREFIX} Error procesando respuesta:`, error.message);
    return { success: false, error: error.message };
  }
}

// Función auxiliar para analizar datos de Holded
function analyzeHoldedData(data: any, endpoint: any): any {
  const LOG_PREFIX = '🟢 [HOLDED-TEST]';
  
  let dataInfo = '';
  let locationInfo = '';
  
  if (Array.isArray(data)) {
    dataInfo = `Array con ${data.length} elementos`;
    console.log(`${LOG_PREFIX} ${dataInfo}`);
  } else if (typeof data === 'object') {
    dataInfo = `Objeto con propiedades: ${Object.keys(data).slice(0, 5).join(', ')}`;
    console.log(`${LOG_PREFIX} ${dataInfo}`);
  }

  // Información específica según el tipo de endpoint
  switch (endpoint.name) {
    case 'Facturas de compra':
      locationInfo = '🏢 Las facturas digitalizadas aparecen en: Facturas → Facturas de compra';
      break;
    case 'Contactos':
      locationInfo = '👥 Gestión de contactos y proveedores';
      break;
    case 'Documentos generales':
      locationInfo = '📋 Documentos generales - incluye facturas de compra, venta, etc.';
      break;
    default:
      locationInfo = '📄 Endpoint de verificación';
  }

  return {
    endpoint_name: endpoint.name,
    data_structure: dataInfo,
    location_info: locationInfo,
    priority: endpoint.priority,
    url: endpoint.url,
    tested_successfully: true
  };
} 