import { NextRequest, NextResponse } from 'next/server';

const APITEMPLATE_API_KEY = process.env.APITEMPLATE_API_KEY || 'bb6eMzI4MDY6Mjk5ODU6NWs4YmhqZ2NGUlZjUDlNRg=';

export async function GET(request: NextRequest) {
  try {
    console.log('📋 Listando templates disponibles en APITemplate.io...');
    console.log('🔑 API Key:', APITEMPLATE_API_KEY?.substring(0, 10) + '...');

    // Endpoint para listar templates según documentación de APITemplate.io
    const listUrl = 'https://rest.apitemplate.io/v2/list-templates';

    const response = await fetch(listUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': APITEMPLATE_API_KEY,
      }
    });

    console.log('📡 Response status:', response.status);

    const responseText = await response.text();
    console.log('📡 Raw response:', responseText.substring(0, 500) + '...');

    if (!response.ok) {
      console.error('❌ Error listing templates:', response.status, responseText);
      return NextResponse.json({
        success: false,
        error: `Error listing templates: ${response.status}`,
        raw_response: responseText,
        message: 'No se pudieron listar los templates'
      });
    }

    let templates;
    try {
      templates = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse templates response:', parseError);
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON response from APITemplate.io',
        raw_response: responseText
      });
    }

    console.log('✅ Templates listados exitosamente');

    // Buscar si nuestro template existe
    const ourTemplateId = process.env.APITEMPLATE_TEMPLATE_ID || '20877b23684b10a8';
    const templateExists = Array.isArray(templates) ? 
      templates.find(t => t.id === ourTemplateId || t.template_id === ourTemplateId) : 
      false;

    return NextResponse.json({
      success: true,
      message: 'Templates listados exitosamente',
      templates: templates,
      template_count: Array.isArray(templates) ? templates.length : 'N/A',
      our_template_id: ourTemplateId,
      our_template_exists: !!templateExists,
      our_template_details: templateExists || null,
      api_key_works: true
    });

  } catch (error) {
    console.error('💥 Error listing templates:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Error al conectar con APITemplate.io para listar templates'
    });
  }
} 