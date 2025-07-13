import { NextRequest, NextResponse } from 'next/server';

const APITEMPLATE_API_KEY = process.env.APITEMPLATE_API_KEY || 'bb6eMzI4MDY6Mjk5ODU6NWs4YmhqZ2NGUlZjUDlNRg=';
const APITEMPLATE_TEMPLATE_ID = process.env.APITEMPLATE_TEMPLATE_ID || '20877b23684b10a8';
const APITEMPLATE_API_URL = 'https://rest.apitemplate.io/v2/create-pdf';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Endpoint de prueba directo para APITemplate.io',
    environment_check: {
      api_key_set: !!process.env.APITEMPLATE_API_KEY,
      api_key_length: process.env.APITEMPLATE_API_KEY?.length || 0,
      api_key_first_10: process.env.APITEMPLATE_API_KEY?.substring(0, 10) || 'NOT SET',
      template_id_set: !!process.env.APITEMPLATE_TEMPLATE_ID,
      template_id_value: process.env.APITEMPLATE_TEMPLATE_ID || 'NOT SET',
      api_url: APITEMPLATE_API_URL
    },
    use_post_to_test: true,
    note: 'Ahora probará diferentes formatos de template_id'
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 TESTING DIFFERENT TEMPLATE_ID FORMATS...');
    console.log('🔑 API Key:', APITEMPLATE_API_KEY?.substring(0, 10) + '...');
    console.log('📋 Template ID:', APITEMPLATE_TEMPLATE_ID);
    console.log('🌐 API URL:', APITEMPLATE_API_URL);

    // Probar diferentes formatos que APITemplate.io podría usar
    const testFormats = [
      {
        name: 'template_id (actual)',
        data: {
          template_id: APITEMPLATE_TEMPLATE_ID,
          supplier: "TEST SUPPLIER",
          date: "2025-01-15",
          total_amount: 100
        }
      },
      {
        name: 'templateId (camelCase)',
        data: {
          templateId: APITEMPLATE_TEMPLATE_ID,
          supplier: "TEST SUPPLIER",
          date: "2025-01-15",
          total_amount: 100
        }
      },
      {
        name: 'template (sin _id)',
        data: {
          template: APITEMPLATE_TEMPLATE_ID,
          supplier: "TEST SUPPLIER", 
          date: "2025-01-15",
          total_amount: 100
        }
      },
      {
        name: 'id (solo id)',
        data: {
          id: APITEMPLATE_TEMPLATE_ID,
          supplier: "TEST SUPPLIER",
          date: "2025-01-15", 
          total_amount: 100
        }
      }
    ];

    const results = [];

    for (const testFormat of testFormats) {
      console.log(`\n🔄 Probando formato: ${testFormat.name}`);
      console.log('📦 Request data:', JSON.stringify(testFormat.data, null, 2));

      try {
        const response = await fetch(APITEMPLATE_API_URL, {
          method: 'POST',
          headers: {
            'X-API-KEY': APITEMPLATE_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testFormat.data)
        });

        const responseText = await response.text();
        console.log(`📡 ${testFormat.name} - Status: ${response.status}`);
        console.log(`📡 ${testFormat.name} - Response: ${responseText.substring(0, 200)}...`);

        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (parseError) {
          responseData = { raw_response: responseText };
        }

        results.push({
          format: testFormat.name,
          status: response.status,
          success: response.ok,
          response: responseData,
          request_data: testFormat.data
        });

        // Si funciona, devolver inmediatamente el exitoso
        if (response.ok) {
          console.log(`✅ ÉXITO con formato: ${testFormat.name}`);
          return NextResponse.json({
            success: true,
            message: `Conexión exitosa con formato: ${testFormat.name}`,
            working_format: testFormat.name,
            api_response: responseData,
            request_data: testFormat.data,
            all_results: results
          });
        }

      } catch (fetchError) {
        console.error(`❌ Error de red con ${testFormat.name}:`, fetchError);
        results.push({
          format: testFormat.name,
          status: 'NETWORK_ERROR',
          success: false,
          response: { error: fetchError instanceof Error ? fetchError.message : 'Unknown error' },
          request_data: testFormat.data
        });
      }
    }

    console.log('❌ Ningún formato funcionó');
    
    return NextResponse.json({
      success: false,
      message: 'Ningún formato de template_id funcionó',
      all_results: results,
      suggestion: 'Verifica que el template_id existe en tu cuenta de APITemplate.io'
    });

  } catch (error) {
    console.error('💥 Error general:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Error general al probar formatos'
    });
  }
} 