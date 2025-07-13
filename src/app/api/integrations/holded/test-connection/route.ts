import { NextRequest, NextResponse } from 'next/server';

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

    console.log('🔐 Testing Holded connection with key:', apiKey.substring(0, 8) + '...');
    console.log('🧪 Test mode:', testMode);

    // URL base según documentación oficial
    const baseUrl = 'https://api.holded.com/api';

    // Endpoints según documentación oficial de Holded
    const endpoints = [
      // Facturas de compra (purchase) - donde aparecen las facturas digitalizadas
      {
        url: `${baseUrl}/invoicing/v1/documents/purchase`,
        name: 'Facturas de compra (purchase)',
        description: 'Aquí aparecen las facturas de compra digitalizadas'
      },
      // Documentos generales (con parámetros para filtrar)
      {
        url: `${baseUrl}/invoicing/v1/documents`,
        name: 'Documentos generales',
        description: 'Listado de todos los tipos de documentos'
      },
      // Contactos como respaldo
      {
        url: `${baseUrl}/invoicing/v1/contacts`,
        name: 'Contactos',
        description: 'Endpoint de respaldo para verificar conexión'
      }
    ];

    console.log('🎯 Probando endpoints según documentación oficial de Holded...');

    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      console.log(`🌐 [${i + 1}/${endpoints.length}] Probando: ${endpoint.name}`);
      console.log(`📍 URL: ${endpoint.url}`);
      
      try {
        const response = await fetch(endpoint.url, {
          method: 'GET',
          headers: {
            'key': apiKey.trim(),
            'Content-Type': 'application/json'
          }
        });

        console.log(`📡 Status: ${response.status} | Content-Type: ${response.headers.get('content-type')}`);

        if (!response.ok) {
          console.log(`❌ Endpoint ${i + 1} falló con status: ${response.status}`);
          
          if (response.status === 401) {
            return NextResponse.json(
              { error: 'API key inválida o sin permisos' },
              { status: 401 }
            );
          }
          
          if (i === endpoints.length - 1) {
            const errorText = await response.text();
            console.log(`❌ Error final:`, errorText);
            return NextResponse.json(
              { error: `Error en API de Holded: ${response.status}` },
              { status: response.status }
            );
          }
          continue;
        }

        const rawResponse = await response.text();
        console.log(`📋 Respuesta (primeros 200 chars):`, rawResponse.substring(0, 200) + '...');

        // Verificar si es HTML (error de endpoint)
        if (rawResponse.includes('<div') || rawResponse.includes('<html')) {
          console.log(`❌ Endpoint ${i + 1} devolvió HTML en lugar de JSON`);
          continue;
        }

        // Verificar si es JSON válido
        if (!rawResponse.trim()) {
          console.log(`❌ Endpoint ${i + 1} devolvió respuesta vacía`);
          continue;
        }

        let jsonData;
        try {
          jsonData = JSON.parse(rawResponse);
          console.log(`✅ Endpoint ${i + 1} devolvió JSON válido!`);
        } catch (parseError) {
          console.log(`❌ Endpoint ${i + 1} - JSON inválido:`, parseError);
          continue;
        }

        // Analizar estructura de datos
        let dataInfo = '';
        if (Array.isArray(jsonData)) {
          dataInfo = `Array con ${jsonData.length} elementos`;
          console.log(`📊 ${dataInfo}`, jsonData.slice(0, 1));
        } else if (typeof jsonData === 'object') {
          dataInfo = `Objeto con propiedades: ${Object.keys(jsonData).join(', ')}`;
          console.log(`📊 ${dataInfo}`);
        }

        // Información específica según el tipo de endpoint
        let locationInfo = '';
        if (endpoint.url.includes('/documents/purchase')) {
          locationInfo = '🏢 Las facturas digitalizadas aparecen en: Facturas → Facturas de compra';
        } else if (endpoint.url.includes('/documents')) {
          locationInfo = '📋 Documentos generales - incluye facturas de compra, venta, etc.';
        } else {
          locationInfo = '👥 Contactos - endpoint de verificación';
        }

        return NextResponse.json({
          success: true,
          message: 'Conexión exitosa con Holded',
          endpoint: {
            name: endpoint.name,
            url: endpoint.url,
            description: endpoint.description
          },
          dataStructure: dataInfo,
          locationInfo: locationInfo,
          sampleData: Array.isArray(jsonData) ? jsonData.slice(0, 1) : jsonData,
          holded_info: {
            donde_aparecen_facturas: 'Facturas → Facturas de compra',
            tipo_documento: 'purchase',
            endpoint_facturas_compra: `${baseUrl}/invoicing/v1/documents/purchase`
          }
        });

      } catch (fetchError: any) {
        console.log(`💥 Error en endpoint ${i + 1}:`, fetchError.message);
        continue;
      }
    }

    // Si ningún endpoint funcionó
    return NextResponse.json(
      { error: 'No se pudo conectar con ningún endpoint de Holded' },
      { status: 500 }
    );

  } catch (error) {
    console.error('Error en test-connection:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 